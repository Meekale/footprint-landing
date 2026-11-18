# Pinch Scanner Implementation Plan

> For agentic workers: execute inline; the user explicitly requested implementation.

**Goal:** Deliver the approved calibration-ready camera scanner and Python model pipeline.

**Architecture:** Expo captures and reviews images. A loopback Python API runs a pretrained
hand detector, measures user-marked geometry, loads fitted site calibrations, and
calculates a three-site skinfold estimate. A restricted Metro proxy uses the existing
development tunnel so no separate backend tunnel or phone URL setup is necessary.

**Tech Stack:** Expo 58, JavaScript, Python 3.12, FastAPI, Pillow, NumPy, MediaPipe.

**Spec:** ../specs/2026-10-26-pinch-scanner-design.md

## Global constraints

- No invented body-fat results or training labels.
- No raw images persisted by the Python service.
- No production deployment or changes to the website.
- Camera estimation requires a real site calibration artifact.

## Task 1: Python measurement and model pipeline

- [x] Add unittest cases for `estimate_body_fat`, `projected_width_mm`, and calibration rejection.
- [x] Run `python -m unittest discover -s algorithm/tests -v` and confirm missing-module failure.
- [x] Implement `algorithm/bodyfat.py`, `geometry.py`, `calibration.py`, and `train.py`.
- [x] Add `vision.py` and `api.py`: `POST /analyze`, `POST /estimate`, `GET /health`.
- [x] Verify the formulas with independent fixed values, participant holdout, image rejection,
      authenticated API requests, request size limits, and no-result behavior without labels.

## Task 2: Guided Expo capture and result flow

- [x] Add `src/protocol.js` for exact three-site instructions and repeat count.
- [x] Add `src/api.js` for authenticated requests with timeouts and errors.
- [x] Add `src/PhotoReview.js` for correctly transformed normalized annotation coordinates.
- [x] Add `src/HandGuide.js` for an adjustable framing guide, explicitly not a ruler.
- [x] Replace `App.js` with profile, capture, review, site progress, caliper, and result screens.
- [x] Verify camera permission handling, background behavior, double-capture protection,
      reset/edit invalidation, and incomplete workflow handling.

## Task 3: Local development and verification

- [x] Add `scripts/dev.cjs` to start authenticated Python and Expo processes together.
- [x] Add `metro.config.js` to proxy only the three analysis routes to loopback.
- [x] Download the official Hand Landmarker checkpoint; record source and SHA256.
- [x] Update setup instructions, calibration CSV documentation, and ignored artifacts.
- [x] Run Python tests, Expo compatibility check, and an iOS export.
- [x] Start localhost-only Expo and Python; verify authenticated API reachability through Metro.
- [x] User explicitly approved external photo transport. Started ngrok, verified authenticated sample-image inference and the iOS bundle over HTTPS, and generated `.expo/phone-qr-scanner.png`.

Physical camera and anatomical landmark correctness require testing on the user's iPhone.
No camera accuracy claim is made before real calibration and independent validation.

## Verification results

16 Python tests passed. Expo dependencies are compatible. The iOS export succeeded.
The official MediaPipe sample produces 21 hand landmarks through the actual Metro-to-Python
connection. Authentication, caliper calculations, and missing-calibration rejection passed
in that running integration. Native camera and touch input need a physical iPhone.
