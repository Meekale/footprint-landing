"""Fit existing ridge regression to real, participant-labeled caliper pairs."""
import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

VALID_SITES = {'chest', 'abdomen', 'thigh', 'triceps', 'suprailiac'}


def fit_models(rows):
    grouped = defaultdict(list)
    for row in rows:
        participant = row['participant_id'].strip()
        site = row['site'].strip()
        feature, target = float(row['projected_fold_width_mm']), float(row['caliper_mm'])
        if not participant or site not in VALID_SITES:
            raise ValueError('Every record needs a participant identifier and a supported site.')
        if not all(map(math.isfinite, (feature, target))) or not (1 <= feature <= 100 and 2 <= target <= 60):
            raise ValueError('Training measurements must be finite and in supported ranges.')
        grouped[site].append((participant, feature, target))
    if not grouped:
        raise ValueError('No calibration records supplied.')
    models = {}
    for site, records in grouped.items():
        people = sorted({row[0] for row in records})
        if len(people) < 10 or len(records) < 30:
            raise ValueError(f'{site}: at least 30 real pairs from 10 people are required for a development model, not clinical validation.')
        # Deterministic participant holdout; no person's images cross the split.
        rng = np.random.default_rng(42)
        rng.shuffle(people)
        test_count = max(2, len(people) // 5)
        test_people = set(people[:test_count])
        train = [r for r in records if r[0] not in test_people]
        test = [r for r in records if r[0] in test_people]
        x, y = np.array([r[1] for r in train]), np.array([r[2] for r in train])
        if float(np.ptp(x)) < 5:
            raise ValueError(f'{site}: collect a wider range of real pinch widths.')
        # Closed-form one-feature ridge regression, with an unpenalized intercept.
        centered = x - x.mean()
        slope = float(centered @ (y - y.mean()) / (centered @ centered + 1.0))
        intercept = float(y.mean() - slope * x.mean())
        if slope <= 0:
            raise ValueError(f'{site}: no positive measurement relationship; do not deploy this calibration.')
        tx, ty = np.array([r[1] for r in test]), np.array([r[2] for r in test])
        errors = slope * tx + intercept - ty
        models[site] = {
            'slope': slope, 'intercept': intercept,
            'min_feature_mm': float(x.min()), 'max_feature_mm': float(x.max()),
            'holdout_mae_mm': float(np.abs(errors).mean()),
            'holdout_bias_mm': float(errors.mean()),
            'train_participants': len(people) - test_count,
            'test_participants': test_count,
            'training_pairs': len(train), 'test_pairs': len(test),
            'test_participant_ids': sorted(test_people),
        }
    return {
        'schema_version': 1, 'feature': 'projected_fold_width_mm',
        'algorithm': 'ridge regression, alpha=1', 'status': 'experimental',
        'created_at': datetime.now(timezone.utc).isoformat(), 'sites': models,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pairs', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('algorithm/models/calibration.json'))
    args = parser.parse_args()
    with args.pairs.open(newline='', encoding='utf-8-sig') as source:
        model = fit_models(list(csv.DictReader(source)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(model, indent=2, allow_nan=False), encoding='utf-8')
    for site, result in model['sites'].items():
        print(f'{site}: held-out MAE {result["holdout_mae_mm"]:.2f} mm; {result["test_participants"]} test participants')
    print(f'Experimental calibration saved to {args.output}. Restart the analysis service to load it.')


if __name__ == '__main__':
    main()
