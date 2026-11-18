# Python measurement and calibration

## Existing model

`vision.py` runs Google's pretrained Hand Landmarker (`hand_landmarker.task`).
The checkpoint is downloaded from Google's official MediaPipe model storage.
`models/hand_landmarker.source.json` records its source, size, and SHA256.
The model detects hands; it does not segment adipose tissue or predict body fat.

`geometry.py` computes a projected visible width from four user-marked points
and a measured fingernail-width reference. Coordinates are normalized against
the displayed photograph, then converted to original-image pixel distances.
Hand world-coordinate predictions and finger-tip separation are not used as rulers.

## Calibration data

The app exports CSV rows with these columns:

```csv
participant_id,site,projected_fold_width_mm,caliper_mm
```

There are deliberately no example labeled rows or installed calibration model.
Obtain consent and real paired measurements; do not infer or invent labels.
Use a stable anonymous identifier for every session belonging to the same person.
Allowed sites: `chest`, `abdomen`, `thigh`, `triceps`, `suprailiac`.

A qualified operator should standardize anatomical marks, the pinch procedure,
photographic viewpoint, reference measurement, and corresponding caliper readings.
Document how photo and caliper readings are paired because applying a caliper
changes tissue compression. Collect across people, fold thicknesses, phones,
skin tones and capture conditions. Avoid recording names in training files.

Exported `caliper_mm` values are blank. Fill them only from the actual paired
caliper readings. Store the completed CSV under ignored `algorithm/data/`.

## Fit the existing ridge-regression calibration

```powershell
.\.venv\Scripts\python.exe -m algorithm.train --pairs algorithm/data/pairs.csv
```

The command requires at least 30 pairs from 10 distinct people per supplied site
as an implementation guard for a development experiment. These numbers do not
constitute adequate clinical validation or a sample-size calculation.

It performs deterministic participant-separated holdout, fits one-feature ridge
regression (alpha 1) using training participants only, and reports held-out MAE
and bias in millimeters. The saved model is not refitted on held-out people.
Inputs outside the training feature range are rejected. Nonpositive fitted
relationships are rejected. It does not train an end-to-end body-fat predictor.

Output: ignored `algorithm/models/calibration.json`. Restart the full development
session to load it. The image API returns `experimental` site thickness only
where a real site model is present and the feature is within range. All three
sites required by the selected equation must be calibrated before the camera
workflow can calculate an experimental equation estimate.

Thickness MAE is not a body-fat confidence interval. Before presenting accuracy
claims, independently validate the complete workflow against DXA or a suitable
body-composition reference, quantify bias and limits of agreement, evaluate
repeatability and subgroups, and hold out people/devices/sites as appropriate.
This prototype has no such validation and should not guide medical decisions.

## API

The development launcher provides the random `SCAN_API_TOKEN` to Python and
`EXPO_PUBLIC_SCAN_TOKEN` to Expo. POST requests require `Authorization: Bearer …`.
Never commit tokens, raw images, or training measurements.

- `GET /health`: service, hand-model presence, and calibrated-site status.
- `POST /analyze`: `image_base64`, `site`, `reference_mm`, optional four `points`.
  Without points: capture quality and hand detection. With points: projected
  width and fitted thickness only if a real calibration is available.
- `POST /estimate`: `equation`, `age`, `source`, and three readings per required
  site in `measurements`. Source is `caliper` or `camera`. Camera requests are
  rejected when site calibrations are missing.

Requests are limited to 12 MB; compressed image content is limited to 8 MB.
No raw photos are stored. The service uses a lock around MediaPipe inference.
