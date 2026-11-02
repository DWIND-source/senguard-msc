"""Export one real WT equilibration frame, never a production trajectory.

Usage: python site/tools/build_md_preview.py INPUT_DIR
INPUT_DIR contains npt.gro and the two topol_Protein_chain_*.itp files
from Kaggle kernel H. Only rigid periodic-image translations are applied.
"""
import argparse
import gzip
import hashlib
import json
from itertools import product
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def topology(path):
    section, atoms, bonds = '', [], []
    for line in path.read_text().splitlines():
        line = line.split(';')[0].strip()
        if line.startswith('['):
            section = line.strip('[] ')
        elif line and not line.startswith('#'):
            p = line.split()
            if section == 'atoms':
                atoms.append({'resi': int(p[2]), 'name': p[3], 'atom': p[4]})
            elif section == 'bonds':
                bonds.append((int(p[0]) - 1, int(p[1]) - 1))
    return atoms, bonds


def build(source, dest):
    lines = (source / 'npt.gro').read_text().splitlines()
    n = int(lines[1])
    assert len(lines) == n + 3, 'Incomplete GRO file'
    rows = lines[2:2 + n]
    xyz = np.array([[float(l[i:i+8]) * 10 for i in (20, 28, 36)] for l in rows])
    box = np.array(list(map(float, lines[-1].split()))) * 10
    cell = np.diag(box[:3]) if len(box) == 3 else np.array([
        [box[0], box[3], box[4]], [box[5], box[1], box[6]], [box[7], box[8], box[2]]])
    a, ba = topology(source / 'topol_Protein_chain_A.itp')
    b, bb = topology(source / 'topol_Protein_chain_B.itp')
    na, np_ = len(a), len(a) + len(b)
    atoms = [dict(x, chain='CDK6') for x in a] + [dict(x, chain='p16') for x in b]
    assert all(x['atom'] == rows[i][10:15].strip() for i, x in enumerate(atoms))
    ca_a = [i for i, x in enumerate(a) if x['atom'] == 'CA']
    ca_b = [na + i for i, x in enumerate(b) if x['atom'] == 'CA']
    assert (len(ca_a), len(ca_b)) == (292, 125), 'Unexpected chain lengths'
    # Each protein chain is whole in this GRO, but can be in a different box image.
    for ids in (ca_a, ca_b):
        assert np.linalg.norm(np.diff(xyz[ids], axis=0), axis=1).max() < 4.5
    shifts = np.array(list(product(range(-2, 3), repeat=3))) @ cell
    delta = xyz[ca_b].mean(axis=0) - xyz[ca_a].mean(axis=0)
    shift = shifts[np.argmin(np.linalg.norm(shifts + delta, axis=1))]
    xyz[na:np_] += shift
    ca = ca_a + ca_b
    center = xyz[ca].mean(axis=0)
    xyz -= center
    # Wrap solvent into the periodic cell nearest to the same protein center.
    frac = xyz[np_:] @ np.linalg.inv(cell)
    xyz[np_:] = (frac - np.rint(frac)) @ cell
    d = np.linalg.norm(xyz[ca_a, None, :] - xyz[None, ca_b, :], axis=2)
    assert d.min() < 10, 'Periodic images do not form the expected complex'
    interface = np.r_[np.where((d < 10).any(axis=1))[0],
                      len(ca_a) + np.where((d < 10).any(axis=0))[0]].tolist()
    markers = {'CDK6': {31, 104, 149, 155}, 'p16': {24, 84, 123}}
    side = [i for i, x in enumerate(atoms) if x['resi'] in markers[x['chain']]
            and x['atom'] != 'CA' and not x['atom'].startswith('H')]
    ids = ca + side
    remap = {v: k for k, v in enumerate(ids)}
    bonds = [(remap[i], remap[j]) for i, j in ba + [(i+na, j+na) for i, j in bb]
             if i in remap and j in remap]
    oxygen = [i for i in range(np_, n) if rows[i][5:10].strip() == 'SOL' and rows[i][10:15].strip() == 'OW']
    ions = [i for i in range(np_, n) if rows[i][5:10].strip() in ('NA', 'CL')]
    colors = {'O': '#ed6b64', 'N': '#79a8ff', 'S': '#f0d86a', 'C': '#d5dce5'}
    payload = {
        'status': 'equilibration_preview', 'source': 'phongnguyendinh/senguard-msc-h',
        'sourceFile': 'systems/wt/npt.gro',
        'sourceSha256': hashlib.sha256((source / 'npt.gro').read_bytes()).hexdigest(),
        'units': 'angstrom', 'label': 'WT, one NPT equilibration frame',
        'description': 'A real GROMACS equilibration snapshot. Rotation changes the camera only; this is not production playback.',
        'transform': 'p16 translated by a periodic box vector; all coordinates centered on protein C-alpha mean; solvent wrapped into the same cell.',
        'p16ImageShiftAngstrom': shift.round(5).tolist(),
        'natoms': len(ids), 'nca': len(ca), 'frames': 1,
        'chains': [{'start': 0, 'count': len(ca_a)}, {'start': len(ca_a), 'count': len(ca_b)}],
        'coords': xyz[ids].round(3).ravel().tolist(), 'bonds': bonds,
        'sideColors': [colors.get(atoms[i]['atom'][0], '#d5dce5') for i in side],
        'interface': interface, 'interfaceDefinition': 'C-alpha pairs within 10 angstrom in this snapshot, for highlighting only.',
        'oxygen': xyz[oxygen].round(3).ravel().tolist(), 'ions': xyz[ions].round(3).ravel().tolist(),
        'residues': [{k: atoms[i][k] for k in ('chain', 'resi', 'name')} for i in ca],
        'totalAtoms': n, 'waterMolecules': len(oxygen), 'ionCount': len(ions),
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(f'Exported {len(ca)} C-alpha atoms, {len(oxygen)} waters; {dest.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'site/data/md/preview.json.gz')
    args = parser.parse_args()
    build(args.source, args.output)
