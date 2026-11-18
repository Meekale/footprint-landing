import unittest

import numpy as np

from algorithm.torso_data import assign_groups, fit_ridge, make_splits, metrics, predict_head


class TorsoTrainingTests(unittest.TestCase):
    def test_subject_and_duplicate_groups_never_cross_splits(self):
        samples = [
            {'participant_id': 'A', 'exact_hash': 'one', 'difference_hash': 0},
            {'participant_id': 'A', 'exact_hash': 'two', 'difference_hash': (1 << 64)-1},
            {'participant_id': 'B', 'exact_hash': 'one', 'difference_hash': 0},
            {'participant_id': 'C', 'exact_hash': 'three', 'difference_hash': 0xAAAAAAAAAAAAAAAA},
        ]
        groups = assign_groups(samples)
        self.assertEqual(groups[0], groups[1])
        self.assertEqual(groups[0], groups[2])
        self.assertNotEqual(groups[0], groups[3])
        expanded = list(range(100)) + [0, 1, 2]
        splits = make_splits(expanded)
        seen = []
        for indices in splits.values():
            members = {expanded[index] for index in indices}
            for previous in seen:
                self.assertFalse(previous & members)
            seen.append(members)

    def test_small_dataset_rejected(self):
        with self.assertRaises(ValueError):
            make_splits(list(range(20)))

    def test_regularized_head_learns_from_features(self):
        # Numerical fixture only, never installed as a body-fat model.
        x = np.arange(100, dtype=float).reshape(50, 2)
        y = x[:, 0] * .2 + 5
        head = fit_ridge(x[:40], y[:40], .01)
        predicted = predict_head(head, x[40:])
        self.assertLess(metrics(y[40:], predicted)['mae_label_points'], .01)

    def test_nan_training_values_rejected(self):
        with self.assertRaises(ValueError):
            fit_ridge(np.array([[1], [float('nan')]]), np.array([1, 2]), 1)

    def test_training_mean_and_scale_do_not_use_test_data(self):
        head = fit_ridge(np.array([[1], [3]]), np.array([10, 20]), 1)
        self.assertEqual(head['mean'][0], 2)
        self.assertEqual(head['scale'][0], 1)
        self.assertTrue(np.isfinite(predict_head(head, np.array([[1000]]))).all())


if __name__ == '__main__':
    unittest.main()
