"""Synthetic tests of gate logic, not molecular simulation results."""
import copy
import unittest
from md_gate import SYSTEMS, evaluate, exact_one_sided


class GateTests(unittest.TestCase):
    def setUp(self):
        self.data = {'duration_ns': {s: [25, 25, 25] for s in SYSTEMS},
                     'mmgbsa': {'wt': [-50, -49, -48], 'r24p': [-40, -39, -38],
                                'd84n': [-44, -43, -42], 'h123q': [-50, -48, -47]}}

    def test_separation_and_exact_p(self):
        result = evaluate(self.data)
        self.assertTrue(result['passed'])
        self.assertEqual(result['permutation_p_one_sided']['r24p'], .05)

    def test_tied_control_is_not_separated(self):
        self.data['mmgbsa']['r24p'][0] = -48
        self.assertFalse(evaluate(self.data)['passed'])

    def test_benign_must_not_separate(self):
        self.data['mmgbsa']['h123q'] = [-47, -46, -45]
        self.assertFalse(evaluate(self.data)['passed'])

    def test_large_opposite_benign_shift_fails(self):
        self.data['mmgbsa']['h123q'] = [-90, -91, -92]
        self.assertFalse(evaluate(self.data)['passed'])

    def test_invalid_inputs_cannot_pass(self):
        variants = [copy.deepcopy(self.data) for _ in range(5)]
        variants[0]['duration_ns']['wt'][0] = 14.95
        variants[1]['duration_ns']['wt'][0] = 24
        variants[2]['mmgbsa']['wt'].pop()
        variants[3]['mmgbsa']['d84n'][1] = float('nan')
        variants[4]['mmgbsa']['h123q'][1] = None
        for data in variants:
            with self.subTest(data=data):
                self.assertFalse(evaluate(data)['tested'])
                self.assertIsNone(evaluate(data)['passed'])

    def test_null_permutation_p(self):
        self.assertEqual(exact_one_sided([0, 0, 0], [0, 0, 0]), 1)


if __name__ == '__main__':
    unittest.main()
