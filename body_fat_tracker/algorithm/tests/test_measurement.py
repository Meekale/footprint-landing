import math
import unittest

from algorithm.bodyfat import estimate_body_fat
from algorithm.geometry import projected_width_mm
from algorithm.calibration import CalibrationStore


class MeasurementTests(unittest.TestCase):
    def test_male_formula_fixed_reference(self):
        result = estimate_body_fat('male', 30, {
            'chest': [10, 10, 10], 'abdomen': [20, 20, 20], 'thigh': [15, 15, 15],
        })
        self.assertAlmostEqual(result['body_density'], 1.067697, places=6)
        self.assertAlmostEqual(result['body_fat_percent'], 13.6, places=1)

    def test_female_formula_fixed_reference(self):
        result = estimate_body_fat('female', 30, {
            'triceps': [15, 15, 15], 'suprailiac': [20, 20, 20], 'thigh': [25, 25, 25],
        })
        self.assertAlmostEqual(result['body_density'], 1.0440221, places=7)
        self.assertAlmostEqual(result['body_fat_percent'], 24.1, places=1)

    def test_incomplete_or_inconsistent_repeats_are_rejected(self):
        for values in ([10, 10], [10, 20, 30], [math.nan, 10, 10]):
            with self.assertRaises(ValueError):
                estimate_body_fat('male', 30, {
                    'chest': values, 'abdomen': [20]*3, 'thigh': [15]*3,
                })

    def test_extra_sites_and_unsupported_age_rejected(self):
        measurements = {'chest': [10]*3, 'abdomen': [20]*3, 'thigh': [15]*3}
        for age in (12, 90, math.nan):
            with self.assertRaises(ValueError):
                estimate_body_fat('male', age, measurements)
        with self.assertRaises(ValueError):
            estimate_body_fat('male', 30, {**measurements, 'triceps': [10]*3})

    def test_geometry_preserves_image_aspect_ratio(self):
        # 100 pixels of reference = 20 mm; 60 pixels of fold = 12 mm.
        points = [[.1, .2], [.2, .2], [.4, .4], [.46, .4]]
        self.assertAlmostEqual(projected_width_mm(points, 1000, 500, 20), 12)

    def test_geometry_rejects_degenerate_or_out_of_frame_points(self):
        for points in ([[.1, .1]]*4, [[-1, 0], [0, 1], [0, 0], [1, 1]]):
            with self.assertRaises(ValueError):
                projected_width_mm(points, 1000, 500, 20)

    def test_missing_calibration_never_returns_a_thickness(self):
        model = CalibrationStore(None)
        result = model.predict('abdomen', 12)
        self.assertEqual(result['status'], 'needs_calibration')
        self.assertIsNone(result['thickness_mm'])


if __name__ == '__main__':
    unittest.main()
