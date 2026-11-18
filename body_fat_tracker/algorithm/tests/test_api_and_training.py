import base64
import io
import json
import os
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image

from algorithm.api import app, calibrations
from algorithm.calibration import CalibrationStore
from algorithm.train import fit_models


@contextmanager
def model_file(model):
    file = Path(__file__).resolve().parents[2] / f'.calibration-test-{uuid4().hex}.json'
    try:
        file.write_text(json.dumps(model), encoding='utf-8')
        yield file
    finally:
        file.unlink(missing_ok=True)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'SCAN_API_TOKEN': 'test-session-token'})
        self.env.start()
        self.client = TestClient(app)
        self.headers = {'Authorization': 'Bearer test-session-token'}

    def tearDown(self):
        self.client.close()
        self.env.stop()

    def estimate_payload(self):
        return {'equation': 'male', 'age': 30, 'source': 'caliper',
                'measurements': {'chest': [10]*3, 'abdomen': [20]*3, 'thigh': [15]*3}}

    def test_authentication_and_real_caliper_estimate(self):
        self.assertEqual(self.client.post('/estimate', json=self.estimate_payload()).status_code, 401)
        response = self.client.post('/estimate', json=self.estimate_payload(), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['body_fat_percent'], 13.6)
        self.assertFalse(response.json()['experimental'])

    def test_camera_cannot_bypass_missing_calibration(self):
        with patch.dict(calibrations.sites, {}, clear=True):
            payload = {**self.estimate_payload(), 'source': 'camera'}
            self.assertEqual(self.client.post('/estimate', json=payload, headers=self.headers).status_code, 409)

    def test_invalid_image_rejected(self):
        response = self.client.post('/analyze', headers=self.headers, json={
            'site': 'abdomen', 'reference_mm': 12, 'image_base64': 'not-an-image',
        })
        self.assertEqual(response.status_code, 422)

    def test_uniform_image_requests_retake_without_a_percentage(self):
        image = Image.new('RGB', (500, 700), 'black')
        buffer = io.BytesIO(); image.save(buffer, format='JPEG')
        response = self.client.post('/analyze', headers=self.headers, json={
            'site': 'abdomen', 'reference_mm': 12,
            'image_base64': base64.b64encode(buffer.getvalue()).decode(),
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'retake')
        self.assertIsNone(response.json()['thickness_mm'])
        self.assertNotIn('body_fat_percent', response.json())

    def test_hand_detection_without_labels_yields_only_visible_width(self):
        detected = {'width': 1000, 'height': 500, 'status': 'hand_detected', 'landmarks': []}
        with patch('algorithm.api.hand_analyzer.analyze', return_value=detected), patch.dict(calibrations.sites, {}, clear=True):
            response = self.client.post('/analyze', headers=self.headers, json={
                'site': 'abdomen', 'reference_mm': 20, 'image_base64': 'mocked',
                'points': [[.1, .2], [.2, .2], [.4, .4], [.46, .4]],
            })
        self.assertEqual(response.json()['projected_fold_width_mm'], 12)
        self.assertEqual(response.json()['status'], 'needs_calibration')
        self.assertIsNone(response.json()['thickness_mm'])

    def test_request_size_limit(self):
        response = self.client.post('/analyze', headers=self.headers,
                                    content=b'x' * 12_000_001)
        self.assertEqual(response.status_code, 413)


class TrainingTests(unittest.TestCase):
    def fixtures(self):
        # Artificial data is used only for automated numerical tests, never app inference.
        return [dict(participant_id=f'person-{person}', site='abdomen',
                     projected_fold_width_mm=str(10 + person * 2 + repeat),
                     caliper_mm=str(5 + .6 * (10 + person * 2 + repeat)))
                for person in range(10) for repeat in range(3)]

    def test_insufficient_real_data_rejected(self):
        with self.assertRaises(ValueError):
            fit_models(self.fixtures()[:9])

    def test_participant_holdout_and_extrapolation(self):
        model = fit_models(self.fixtures())
        entry = model['sites']['abdomen']
        self.assertEqual(entry['train_participants'], 8)
        self.assertEqual(entry['test_participants'], 2)
        self.assertLess(entry['holdout_mae_mm'], .1)
        with model_file(model) as file:
            fitted = CalibrationStore(file)
            self.assertEqual(fitted.predict('abdomen', 20)['status'], 'experimental')
            self.assertIsNone(fitted.predict('abdomen', 99)['thickness_mm'])
            self.assertIsNone(fitted.predict('thigh', 20)['thickness_mm'])

    def test_nonfinite_coefficients_rejected(self):
        model = fit_models(self.fixtures())
        model['sites']['abdomen']['slope'] = float('nan')
        with model_file(model) as file:
            with self.assertRaises(ValueError):
                CalibrationStore(file)


if __name__ == '__main__':
    unittest.main()
