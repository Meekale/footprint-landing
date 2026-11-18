"""Source-aware data validation and leakage-resistant splits for torso experiments."""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

LABEL_SOURCES = {'reddit_visual', 'auto_labeled', 'reported_dexa'}


def image_signatures(file):
    with Image.open(file) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        if min(image.size) < 64:
            raise ValueError(f'Image too small: {file.name}')
        exact = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        gray = np.array(image.convert('L').resize((9, 8), Image.Resampling.LANCZOS))
        bits = (gray[:, 1:] > gray[:, :-1]).reshape(-1)
        difference = sum(int(value) << i for i, value in enumerate(bits))
    return exact, difference


def load_manifest(file):
    file = Path(file).resolve()
    data = json.loads(file.read_text(encoding='utf-8'))
    if data.get('schema_version') != 1 or data.get('label_source') not in LABEL_SOURCES:
        raise ValueError('A version 1 manifest with an explicit supported label_source is required.')
    for key in ('dataset_id', 'source_url', 'license'):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError(f'Dataset provenance is missing: {key}')
    if data.get('view') != 'front_torso' or data.get('population') != 'male':
        raise ValueError('This initial model supports frontal male-torso datasets only.')
    samples = data.get('samples', [])
    if not samples:
        raise ValueError('Dataset has no labeled samples.')
    root = file.parent
    result = []
    for sample in samples:
        image = (root / sample['image']).resolve()
        if not image.is_relative_to(root) or not image.is_file():
            raise ValueError('Every image must exist inside the dataset directory.')
        value = sample['label_percent']
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not 2 <= value <= 60:
            raise ValueError('Labels must be finite percentages between 2 and 60.')
        person = sample.get('participant_id')
        if person is not None and (not isinstance(person, str) or not person.strip()):
            raise ValueError('Participant identifiers must be nonempty strings or null.')
        exact, difference = image_signatures(image)
        result.append({'image': str(image), 'label_percent': float(value),
                       'participant_id': person, 'exact_hash': exact, 'difference_hash': difference})
    return {key: value for key, value in data.items() if key != 'samples'}, result


def assign_groups(samples, threshold=4):
    """Union known participants and near-duplicate images; do not infer identities."""
    parents = list(range(len(samples)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    def union(i, j):
        parents[find(j)] = find(i)

    for i, a in enumerate(samples):
        for j in range(i):
            b = samples[j]
            same_person = a['participant_id'] and a['participant_id'] == b['participant_id']
            duplicate = a['exact_hash'] == b['exact_hash'] or (a['difference_hash'] ^ b['difference_hash']).bit_count() <= threshold
            if same_person or duplicate:
                union(i, j)
    return [find(i) for i in range(len(samples))]


def make_splits(groups, seed=42, minimum_groups=100):
    unique = np.array(sorted(set(groups)))
    if len(unique) < minimum_groups:
        raise ValueError(f'Need at least {minimum_groups} independent identity/duplicate groups for this development split; found {len(unique)}.')
    np.random.default_rng(seed).shuffle(unique)
    train_end = int(len(unique) * .60)
    validation_end = int(len(unique) * .75)
    calibration_end = int(len(unique) * .85)
    allocated = {
        'train': set(unique[:train_end]), 'validation': set(unique[train_end:validation_end]),
        'calibration': set(unique[validation_end:calibration_end]), 'test': set(unique[calibration_end:]),
    }
    return {name: np.array([i for i, group in enumerate(groups) if group in selected], dtype=int)
            for name, selected in allocated.items()}


def fit_ridge(features, targets, alpha):
    features, targets = np.asarray(features, dtype=np.float64), np.asarray(targets, dtype=np.float64)
    if features.ndim != 2 or targets.ndim != 1 or len(features) != len(targets) or len(targets) < 2:
        raise ValueError('Need a feature matrix and a matching target vector.')
    if not np.isfinite(features).all() or not np.isfinite(targets).all() or alpha <= 0:
        raise ValueError('Training values must be finite and regularization positive.')
    mean = features.mean(axis=0)
    scale = features.std(axis=0)
    scale[scale < 1e-8] = 1
    centered = (features - mean) / scale
    intercept = float(targets.mean())
    # Standard ridge regression in its dual form; the backbone stays frozen.
    weights = centered.T @ np.linalg.solve(centered @ centered.T + alpha * np.eye(len(targets)), targets - intercept)
    return {'mean': mean, 'scale': scale, 'weights': weights, 'intercept': np.array(intercept)}


def predict_head(head, features):
    return ((np.asarray(features) - head['mean']) / head['scale']) @ head['weights'] + float(head['intercept'])


def metrics(targets, predicted):
    actual, predicted = np.asarray(targets), np.asarray(predicted)
    error = predicted - actual
    return {'mae_label_points': float(np.abs(error).mean()),
            'rmse_label_points': float(np.sqrt(np.mean(error**2))),
            'bias_label_points': float(error.mean()), 'samples': len(actual)}
