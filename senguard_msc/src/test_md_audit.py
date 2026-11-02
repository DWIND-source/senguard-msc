"""Test rejection of incomplete trajectory time histories."""
import unittest
from audit_md_runs import check_times


class AuditTests(unittest.TestCase):
    def test_complete(self):
        self.assertEqual(check_times([0, 50, 100, 150]), [])

    def test_truncated_history(self):
        self.assertTrue(check_times([15000, 15050, 15100]))

    def test_missing_frame(self):
        self.assertTrue(check_times([0, 50, 150]))

    def test_overlap(self):
        self.assertTrue(check_times([0, 50, 50, 100]))

    def test_empty_or_nonfinite(self):
        for times in ([], [0], [0, float('nan')]):
            self.assertTrue(check_times(times))


if __name__ == '__main__':
    unittest.main()
