"""Train a transfer-learning torso prototype on an explicit, source-labeled manifest."""
import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from .torso_data import assign_groups, fit_ridge, load_manifest, make_splits, metrics, predict_head
from .torso_model import FeatureExtractor, PREPROCESS, sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--backbone', type=Path, default=Path('algorithm/models/torso-backbone/resnet18.pth'))
    parser.add_argument('--output', type=Path, default=Path('algorithm/models/torso'))
    parser.add_argument('--batch-size', type=int, default=16)
    args = parser.parse_args()
    if not args.backbone.is_file():
        raise ValueError('Download the official backbone with python -m algorithm.download_torso_models.')
    if not 1 <= args.batch_size <= 64:
        raise ValueError('Batch size must be 1–64.')
    metadata, samples = load_manifest(args.manifest)
    groups = assign_groups(samples)
    splits = make_splits(groups)
    # Test labels are not consulted for fitting, hyperparameter selection, or residual calibration.
    encoder = FeatureExtractor(args.backbone)
    features = []
    for start in range(0, len(samples), args.batch_size):
        images = []
        for sample in samples[start:start + args.batch_size]:
            with Image.open(sample['image']) as source:
                images.append(source.copy())
        features.append(encoder.extract(images))
        print(f'Encoded {min(start + args.batch_size, len(samples))}/{len(samples)} images', flush=True)
    x = np.concatenate(features)
    y = np.array([sample['label_percent'] for sample in samples])
    train, validation, calibration, test = (splits[name] for name in ('train', 'validation', 'calibration', 'test'))
    candidates = []
    for alpha in (1., 10., 100., 1000., 10000.):
        head = fit_ridge(x[train], y[train], alpha)
        score = metrics(y[validation], predict_head(head, x[validation]))['mae_label_points']
        candidates.append((score, alpha, head))
    validation_mae, alpha, head = min(candidates, key=lambda candidate: candidate[0])
    calibration_errors = np.abs(predict_head(head, x[calibration]) - y[calibration])
    # A descriptive held-out residual quantile; no physiological coverage claim.
    spread = max(.1, float(np.quantile(calibration_errors, .9, method='higher')))
    test_scores = metrics(y[test], predict_head(head, x[test]))
    baseline = metrics(y[test], np.full(len(test), y[train].mean()))
    independent = all(sample['participant_id'] is not None for sample in samples)
    report = {
        'schema_version': 1, 'model_type': 'frozen_resnet18_ridge', 'preprocess': PREPROCESS,
        'dataset_id': metadata['dataset_id'], 'source_url': metadata['source_url'],
        'license': metadata['license'], 'label_source': metadata['label_source'],
        'population': 'male', 'view': 'front_torso', 'status': 'experimental',
        'measurement_accuracy_established': False,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'manifest_sha256': sha256(args.manifest), 'sample_count': len(samples),
        'duplicate_or_identity_groups': len(set(groups)),
        'participant_independence_verified': independent,
        'split_method': 'known participant + perceptual-duplicate groups; seed=42',
        'split_sample_counts': {name: len(indices) for name, indices in splits.items()},
        'alpha': alpha, 'validation_mae_label_points': validation_mae,
        'calibration_abs_error_q90': spread,
        'test_metrics': test_scores, 'training_mean_baseline_test_metrics': baseline,
        'beats_mean_baseline_on_test': test_scores['mae_label_points'] < baseline['mae_label_points'],
        'label_min': float(y[train].min()), 'label_max': float(y[train].max()),
        'limitations': [
            'Metrics describe agreement with the supplied labels, not measured body-fat accuracy.',
            *([] if independent else ['Participant identities are absent; different photos of the same person may remain across splits.']),
            'Male frontal torso images only. External camera, population, and clinical validation are absent.',
        ],
    }
    args.output.mkdir(parents=True, exist_ok=True)
    np.savez(args.output / 'head.npz', **head)
    target_backbone = args.output / 'backbone.pth'
    if args.backbone.resolve() != target_backbone.resolve():
        shutil.copyfile(args.backbone, target_backbone)
    report['sha256'] = {name: sha256(args.output / name) for name in ('head.npz', 'backbone.pth')}
    # model.json is written last: incomplete directories are never marked ready.
    (args.output / 'model.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    assignment = [{'image_sha256': sample['exact_hash'], 'group': int(group),
                   'split': next(name for name, indices in splits.items() if i in indices)}
                  for i, (sample, group) in enumerate(zip(samples, groups))]
    (args.output / 'split-audit.json').write_text(json.dumps(assignment, indent=2), encoding='utf-8')
    print(json.dumps({'test_label_agreement': test_scores, 'mean_baseline': baseline,
                      'output': str(args.output), 'label_source': metadata['label_source'],
                      'participant_independence_verified': independent}, indent=2))


if __name__ == '__main__':
    main()
