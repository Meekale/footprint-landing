# Replaceable Torso Model Implementation Plan

**Goal:** Add a real transfer-learning pipeline and camera interface that can be retrained on a new labeled source.

**Architecture:** A pretrained ResNet-18 extracts torso image features. A trained
regularized head and provenance manifest are loaded by the Python service. A
separate Expo camera mode calls the authenticated torso endpoint.

**Spec:** ../specs/2026-10-26-torso-model-design.md

## Tasks

- [x] Test manifest validation, image grouping, disjoint splits, numerical fitting,
      baseline comparison, missing-artifact behavior, and source labeling.
- [x] Implement `algorithm/torso_data.py`, `torso_model.py`, and `train_torso.py`.
- [x] Add source import commands for local Reddit CSV files, approved HF public
      Parquet files, and already-authorized downloaded DXA image-folder files.
- [x] Train only on a dataset whose files and permitted use are established.
- [x] Add an authenticated `/torso` endpoint and a separate camera/review/result screen.
- [x] Run Python tests, iOS export, and an actual API inference when weights exist.
- [x] Record the dataset, actual label provenance, split limitations, metrics,
      and retraining procedure. No synthetic production training.

The Reddit files were unavailable. The user explicitly approved the separate public auto-labeled dataset for noncommercial use. It was imported, actually trained, evaluated, selected, and served. 24 Python tests and the final iOS export passed. Authenticated pose detection and trained-model inference passed over the approved ngrok tunnel; the phone bundle returned HTTP 200. Native phone capture still requires the user to test it.
