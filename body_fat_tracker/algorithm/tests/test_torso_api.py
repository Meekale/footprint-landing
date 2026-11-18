import os
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient

from algorithm.api import app
from algorithm.torso_model import TorsoPredictor


class TorsoApiTests(unittest.TestCase):
    def test_missing_artifact_refuses_to_invent_a_number(self):
        predictor = TorsoPredictor(Path(__file__).parent / 'no-such-trained-model')
        self.assertFalse(predictor.ready)
        self.assertEqual(predictor.info()['status'], 'untrained')
        with patch.dict(os.environ, {'SCAN_API_TOKEN': 'test-token'}), patch('algorithm.api.torso_predictor', predictor):
            with TestClient(app) as client:
                payload = {'image_base64': 'test', 'age': 25, 'male_population_confirmed': True}
                self.assertEqual(client.post('/torso', json=payload).status_code, 401)
                response = client.post('/torso', json=payload, headers={'Authorization': 'Bearer test-token'})
                self.assertEqual(response.status_code, 503)
                self.assertNotIn('estimate_percent', response.json())

    def test_adult_and_population_inputs_required(self):
        with patch.dict(os.environ, {'SCAN_API_TOKEN': 'test-token'}):
            with TestClient(app) as client:
                for age, confirmed in [(15, True), (25, False)]:
                    response = client.post('/torso', json={'image_base64': 'test', 'age': age,
                        'male_population_confirmed': confirmed}, headers={'Authorization': 'Bearer test-token'})
                    self.assertEqual(response.status_code, 422)

    def test_prediction_preserves_weak_label_provenance(self):
        # Numeric fixture only. No synthetic weights are saved or installed.
        predictor = TorsoPredictor.__new__(TorsoPredictor)
        predictor.metadata = {'label_source': 'auto_labeled', 'calibration_abs_error_q90': 5.,
                              'dataset_id': 'test-fixture', 'license': 'cc-by-nc-4.0'}
        predictor.head = {'mean': np.zeros(512), 'scale': np.ones(512),
                          'weights': np.zeros(512), 'intercept': np.array(20.)}
        class Encoder:
            def extract(self, images):
                return np.zeros((len(images), 512))
        predictor.extractor = Encoder()
        result = predictor.predict(None)
        self.assertEqual(result['estimate_percent'], 20)
        self.assertEqual(result['label_source'], 'auto_labeled')
        self.assertFalse(result['measurement_accuracy_established'])
        self.assertEqual(result['source_label_range'], [15, 25])
        self.assertIn('not measured', result['message'])


if __name__ == '__main__':
    unittest.main()
