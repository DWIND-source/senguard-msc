"""Evaluate amendment 4 without treating trajectory frames as independent replicas.

Input: {"duration_ns": {system: [3 durations]}, "mmgbsa": {system: [3 means]}}.
Durations must describe the common, already-trimmed analysis input, not raw runs.
No scientific result is emitted for missing, nonfinite or unequal inputs.
"""
import argparse
import itertools
import json
import math
from pathlib import Path

SYSTEMS = ('wt', 'r24p', 'd84n', 'h123q')


def exact_one_sided(reference, variant):
    """Enumerate all C(6,3)=20 allocations; positive means weaker binding."""
    values = tuple(reference) + tuple(variant)
    observed = sum(variant) / 3 - sum(reference) / 3
    differences = []
    for ids in itertools.combinations(range(6), 3):
        group = set(ids)
        differences.append(sum(values[i] for i in group) / 3
                           - sum(values[i] for i in range(6) if i not in group) / 3)
    return sum(x >= observed - 1e-10 for x in differences) / len(differences)


def evaluate(data):
    def untested(reason):
        return {'tested': False, 'passed': None, 'note': reason, 'detail': reason}

    durations = data.get('duration_ns', {})
    energy = data.get('mmgbsa', {})
    for field, collection in (('duration', durations), ('MM/GBSA', energy)):
        for system in SYSTEMS:
            row = collection.get(system, [])
            if len(row) != 3 or not all(isinstance(x, (int, float)) and not isinstance(x, bool)
                                      and math.isfinite(x) for x in row):
                return untested(f'{system} requires three finite per-replica {field} values.')
    ns = [x for s in SYSTEMS for x in durations[s]]
    if min(ns) < 15:
        return untested(f'Common trajectory duration is below the pre-registered 15 ns minimum ({min(ns):g} ns).')
    if max(ns) - min(ns) > 1e-6:
        return untested('Replicas have not been trimmed to a common duration.')
    wt = energy['wt']
    shifts = {s: sum(energy[s]) / 3 - sum(wt) / 3 for s in SYSTEMS[1:]}
    separated = {s: min(energy[s]) > max(wt) for s in SYSTEMS[1:]}
    # A large opposite-direction benign effect is not a small shift.
    benign_small = all(abs(shifts['h123q']) < abs(shifts[s]) for s in ('r24p', 'd84n'))
    passed = separated['r24p'] and separated['d84n'] and not separated['h123q'] and benign_small
    return {
        'tested': True, 'passed': passed, 'duration_ns': ns[0],
        'note': 'The pre-registered controls separated.' if passed else 'The pre-registered controls did not separate.',
        'detail': 'Three replica means per system; last 50% of equally trimmed trajectories. '
                  'Positive shifts mean less favorable MM/GBSA energy. Benign shift compared by absolute magnitude. '
                  'No entropy term; these are relative bound-state energies, not binding constants or functional predictions.',
        'shift_kcal_mol': shifts, 'fully_separated_weaker': separated,
        'permutation_p_one_sided': {s: exact_one_sided(wt, energy[s]) for s in SYSTEMS[1:]},
        'benign_shift_smaller': benign_small,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = json.dumps(evaluate(json.loads(args.input.read_text())), indent=2, allow_nan=False) + '\n'
    if args.output:
        args.output.write_text(result)
    else:
        print(result, end='')
