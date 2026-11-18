import json
import math
from pathlib import Path


class CalibrationStore:
    """Load numeric coefficients only; never unpickle externally supplied models."""

    def __init__(self, path):
        self.sites = {}
        if path and Path(path).is_file():
            data = json.loads(Path(path).read_text(encoding='utf-8'))
            if data.get('schema_version') != 1 or data.get('feature') != 'projected_fold_width_mm':
                raise ValueError('Unsupported calibration model schema.')
            for site, model in data['sites'].items():
                required = ['slope', 'intercept', 'min_feature_mm', 'max_feature_mm', 'holdout_mae_mm']
                if any(not math.isfinite(model[k]) for k in required):
                    raise ValueError('Calibration coefficients must be finite.')
                if model['slope'] <= 0 or model['min_feature_mm'] >= model['max_feature_mm']:
                    raise ValueError('Calibration must be increasing with a nonempty supported range.')
                if model.get('train_participants', 0) < 8 or model.get('test_participants', 0) < 2:
                    raise ValueError('Calibration needs participant-separated training and test data.')
                self.sites[site] = model

    def predict(self, site, feature_mm):
        if not math.isfinite(feature_mm):
            raise ValueError('The projected width must be finite.')
        if site not in self.sites:
            return {
                'status': 'needs_calibration', 'thickness_mm': None,
                'message': 'Hand scan measured. This site needs paired caliper data before a body-fat estimate is possible.',
            }
        model = self.sites[site]
        if not model['min_feature_mm'] <= feature_mm <= model['max_feature_mm']:
            return {
                'status': 'outside_calibration', 'thickness_mm': None,
                'message': 'This pinch is outside the model’s training range. No estimate was calculated.',
            }
        thickness = model['slope'] * feature_mm + model['intercept']
        if not 2 <= thickness <= 60:
            return {'status': 'outside_calibration', 'thickness_mm': None,
                    'message': 'Predicted thickness is outside the supported range.'}
        return {
            'status': 'experimental', 'thickness_mm': round(thickness, 2),
            'validation_mae_mm': model['holdout_mae_mm'],
            'message': 'Experimental camera estimate. Held-out thickness error is not a body-fat confidence interval.',
        }
