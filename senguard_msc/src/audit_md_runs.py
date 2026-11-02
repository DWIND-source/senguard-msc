"""Audit the twelve production runs inside Kaggle, before any pooled analysis.

Reads actual XTC timestamps in bounded chunks, verifies topology atom counts,
and saves an audit even on failure. Requires mdtraj. This is not the MD gate.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

SYSTEMS = ('wt', 'r24p', 'd84n', 'h123q')


def check_times(times):
    import numpy as np
    t = np.asarray(times, dtype=float)
    problems = []
    if len(t) < 2 or not np.isfinite(t).all():
        return ['Trajectory requires at least two finite timestamps.']
    if abs(t[0]) > .1:
        problems.append('Trajectory does not include production time zero; continuation history is missing.')
    differences = np.diff(t)
    if (differences <= 0).any():
        problems.append('Duplicate or reversed trajectory timestamps.')
    if not np.allclose(differences, 50, atol=.1, rtol=0):
        problems.append('Trajectory does not have the planned uninterrupted 50 ps frame interval.')
    return problems


def topology_atom_count(path):
    active, count = False, 0
    for line in path.read_text().splitlines():
        clean = line.split(';')[0].strip()
        if clean.startswith('['):
            active = clean.strip('[] ') == 'atoms'
        elif active and clean and not clean.startswith('#'):
            count += 1
    return count


def audit(root, out):
    from mdtraj.formats import XTCTrajectoryFile
    import numpy as np
    result = {'status': 'not_ready', 'protocol': 'ANALYSIS_AMENDMENT_4_MD.md', 'runs': {}, 'errors': []}
    for system in SYSTEMS:
        for rep in range(1, 4):
            rid = f'{system}-{rep}'
            found = list(root.glob(f'**/runs/{rid}/md.tpr'))
            row = {'seed': 2026 + 100 * SYSTEMS.index(system) + rep, 'errors': []}
            result['runs'][rid] = row
            if len(found) != 1:
                row['errors'].append(f'Expected one run directory, found {len(found)}. Select a single version of each kernel.')
                continue
            directory = found[0].parent
            row['source'] = str(directory)
            row['tpr_sha256'] = hashlib.sha256(found[0].read_bytes()).hexdigest()
            if not (directory / 'md.cpt').is_file():
                row['errors'].append('No restart checkpoint.')
            tops = [directory / f'topol_Protein_chain_{c}.itp' for c in 'AB']
            if not all(p.is_file() for p in tops):
                row['errors'].append('Missing chain topology; cannot verify trajectory atom identity.')
                continue
            expected_atoms = sum(topology_atom_count(p) for p in tops)
            trajectories = sorted(directory.glob('md*.xtc'))
            row['trajectory_files'] = [p.name for p in trajectories]
            times, counts = [], set()
            for path in trajectories:
                try:
                    with XTCTrajectoryFile(str(path)) as reader:
                        while True:
                            xyz, t, step, box = reader.read(n_frames=10)
                            if len(t) == 0:
                                break
                            counts.add(xyz.shape[1])
                            times.extend(float(x) for x in t)
                            if not np.isfinite(xyz).all():
                                row['errors'].append(f'Nonfinite coordinates in {path.name}')
                                break
                except Exception as e:
                    row['errors'].append(f'{path.name}: {type(e).__name__}: {e}')
            row['frames'] = len(times)
            row['protein_atoms'] = expected_atoms
            row['observed_atom_counts'] = sorted(counts)
            if counts != {expected_atoms}:
                row['errors'].append('XTC atom count differs from the two protein topologies.')
            row['errors'].extend(check_times(times))
            row['duration_ns'] = max(times) / 1000 if times else None
            logtext = '\n'.join(p.read_text(errors='replace') for p in directory.glob('md*.log'))
            row['lincs_warnings'] = len(re.findall(r'LINCS WARNING', logtext))
            if row['lincs_warnings'] or 'Fatal error' in logtext:
                row['errors'].append('Production log contains LINCS warnings or a fatal error; inspect before analysis.')
            if not logtext:
                row['errors'].append('No production log available.')
    for rid, row in result['runs'].items():
        result['errors'].extend(f'{rid}: {message}' for message in row['errors'])
    if not result['errors']:
        common = min(row['duration_ns'] for row in result['runs'].values())
        result.update(status='ready_for_analysis', common_duration_ns=common,
                      analysis_window_ns=[common / 2, common], gate_minimum_met=common >= 15,
                      target_25ns_met=common >= 25)
        if common < 15:
            result['note'] = 'All runs are readable, but the pre-registered gate is untested below 15 ns. Resume before the final analysis if quota allows.'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps(result, indent=2))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=Path('/kaggle/input'))
    parser.add_argument('--output', type=Path, default=Path('/kaggle/working/md_audit.json'))
    args = parser.parse_args()
    report = audit(args.input, args.output)
    raise SystemExit(0 if report['status'] == 'ready_for_analysis' else 1)
