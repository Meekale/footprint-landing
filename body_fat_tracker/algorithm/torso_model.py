"""Frozen pretrained ResNet-18 features and a replaceable numeric regression head."""
import hashlib
import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import ImageOps

from .torso_data import LABEL_SOURCES, predict_head

PREPROCESS = 'rgb-letterbox-224-imagenet-v1'
BACKBONE_URL = 'https://download.pytorch.org/models/resnet18-f37072fd.pth'


def sha256(file):
    digest = hashlib.sha256()
    with Path(file).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


class FeatureExtractor:
    def __init__(self, checkpoint):
        import torch
        from torchvision.models import resnet18
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        self.torch = torch
        self.model = resnet18(weights=None)
        self.model.load_state_dict(torch.load(checkpoint, map_location='cpu', weights_only=True))
        self.model.fc = torch.nn.Identity()
        self.model.eval().requires_grad_(False)

    def extract(self, images):
        torch = self.torch
        tensors = []
        for image in images:
            padded = ImageOps.pad(ImageOps.exif_transpose(image).convert('RGB'), (224, 224), color=(127, 127, 127))
            array = np.array(padded, dtype=np.float32) / 255
            array = (array - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
            tensors.append(torch.from_numpy(array.transpose(2, 0, 1).copy()))
        with torch.inference_mode():
            return self.model(torch.stack(tensors)).numpy()


class TorsoPredictor:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.metadata = None
        self.extractor = None
        self.head = None
        self.error = None
        metadata_file = self.directory / 'model.json'
        if not metadata_file.exists():
            return
        try:
            metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
            if metadata.get('schema_version') != 1 or metadata.get('model_type') != 'frozen_resnet18_ridge':
                raise ValueError('Unsupported torso model format.')
            if metadata.get('preprocess') != PREPROCESS or metadata.get('label_source') not in LABEL_SOURCES:
                raise ValueError('Missing supported preprocessing or label provenance.')
            if any(not isinstance(metadata.get(key), str) or not metadata[key] for key in ('dataset_id', 'license')):
                raise ValueError('Dataset identity and license must be recorded.')
            if not isinstance(metadata.get('participant_independence_verified'), bool) or not isinstance(metadata.get('test_metrics'), dict):
                raise ValueError('Evaluation metadata is missing.')
            for name in ('backbone.pth', 'head.npz'):
                if not (self.directory / name).is_file():
                    raise ValueError(f'Model component missing: {name}')
                if sha256(self.directory / name) != metadata.get('sha256', {}).get(name):
                    raise ValueError(f'Model checksum mismatch: {name}')
            with np.load(self.directory / 'head.npz', allow_pickle=False) as saved:
                head = {key: saved[key].copy() for key in ('mean', 'scale', 'weights', 'intercept')}
            if any(head[key].shape != (512,) for key in ('mean', 'scale', 'weights')) or head['intercept'].size != 1:
                raise ValueError('Regression-head shape mismatch.')
            if any(not np.isfinite(value).all() for value in head.values()) or np.any(head['scale'] <= 0):
                raise ValueError('Regression head contains invalid values.')
            spread = metadata.get('calibration_abs_error_q90')
            if not isinstance(spread, (float, int)) or not math.isfinite(spread) or spread <= 0:
                raise ValueError('Calibration residual spread is missing.')
            self.metadata, self.head = metadata, head
        except (ValueError, KeyError, OSError) as error:
            self.error = str(error)

    @property
    def ready(self):
        return self.metadata is not None and self.head is not None

    def info(self):
        if not self.ready:
            return {'ready': False, 'status': 'untrained' if not self.error else 'invalid_model',
                    'message': self.error or 'No trained torso artifact is installed yet.'}
        source = self.metadata
        return {'ready': True, 'status': 'experimental', 'dataset_id': source['dataset_id'],
                'label_source': source['label_source'], 'license': source['license'],
                'population': 'male', 'view': 'front_torso',
                'participant_independence_verified': source['participant_independence_verified'],
                'test_metrics': source['test_metrics'],
                'noncommercial_only': 'nc' in source['license'].lower(),
                'measurement_accuracy_established': False}

    def predict(self, image):
        if not self.ready:
            raise RuntimeError(self.error or 'Torso training data is not available yet. No percentage was calculated.')
        if self.extractor is None:
            self.extractor = FeatureExtractor(self.directory / 'backbone.pth')
        features = self.extractor.extract([image])
        prediction = float(predict_head(self.head, features)[0])
        if not math.isfinite(prediction) or not 2 <= prediction <= 60:
            return {'status': 'unsupported', 'estimate_percent': None,
                    'message': 'This image produced an unsupported result. Retake with a clear frontal torso view.'}
        spread = float(self.metadata['calibration_abs_error_q90'])
        source = self.metadata['label_source']
        descriptions = {
            'reddit_visual': 'Trained on Reddit appearance estimates, not measured body fat.',
            'auto_labeled': 'Trained on automatically generated labels, not measured body fat.',
            'reported_dexa': 'Trained on dataset-reported DXA labels; this app has not established clinical accuracy.',
        }
        return {'status': 'experimental', 'estimate_percent': round(prediction, 1),
                'source_label_range': [round(max(0, prediction - spread), 1), round(min(100, prediction + spread), 1)],
                'label_source': source, 'dataset_id': self.metadata['dataset_id'],
                'message': descriptions[source], 'measurement_accuracy_established': False,
                'range_note': 'Spread against source labels only. This is not a confidence interval for your actual body fat.',
                'license': self.metadata['license']}
