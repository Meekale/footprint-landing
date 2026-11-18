# Pinch-photo training-data search

Search date: October 26, 2026.

The user requested online training photographs, then explicitly confirmed:
keep the existing pinch scanner; do not substitute a torso-photo model.

## Outcome

No suitable, accessible, labeled pinch-photo dataset was located in this search.
This is a search result, not proof that no such dataset exists anywhere.
No prediction model was trained, no labels were invented, and no calibration
artifact was installed. The existing pretrained hand detector remains unchanged.

## Eligibility for the current calibration pipeline

The data must pair a photograph of the actual hand-held skinfold with its
corresponding physical caliper measurement in millimeters. Each example needs
the anatomical site, a stable anonymous participant identifier, a usable size
reference, and sufficient information to reproduce the app's projected-width
measurement. Training use must be permitted and the files must be accessible.

Body-fat percentages attached to torso pictures do not label the relationship
between a pinched fold's photographed geometry and a caliper reading. Tabular
skinfold datasets without matching photographs lack the visual input.

## Sources reviewed

| Candidate | What was verified | Decision |
| --- | --- | --- |
| [Torso Body Fat Dataset (DEXA)](https://huggingface.co/datasets/Sariax/MasterMIARFID_torsobf_dexa) | Card advertises 200 torso samples and DEXA labels. Public API reports manually gated access. The label provenance was not independently verified. | Wrong image task; access gated. Not downloaded for training. |
| [Body-Fat-Regression-from-Reddit-Image-Dataset](https://github.com/Kayse-Johnson/Body-Fat-Regression-from-Reddit-Image-Dataset) | README describes male frontal-body photos and body-fat labels from user comments or hand labeling. | Wrong input and no verified physical skinfold labels. Not used. |
| [Four skinfold calipers study dataset](https://zenodo.org/records/6385367) | Public record lists a spreadsheet. Downloaded the 95,433-byte XLSX into memory and inspected its ZIP structure: one worksheet, zero `xl/media/` images. | Measurement data without paired photographs. Not used for image training. |
| [New Caledonia anthropometry dataset](https://zenodo.org/records/15485834) | Repository description identifies anthropometric recordings, skinfold-derived quantities, questionnaires, and fitness measurements; no matching pinch-photo collection was identified. | No eligible photo/caliper pairs identified. |
| [PinchTest repository](https://github.com/VisVires/PinchTest) | Inspected repository tree through GitHub's public API. Eleven image assets consist of launcher icons and one apparent product-reference image; no CSV, XLSX, Parquet, ONNX, PyTorch, or HDF5 training artifacts were listed. | Application source, not the required labeled dataset. |
| [UAB digital-image body-composition study](https://digitalcommons.library.uab.edu/datasets/296/) | Catalog describes de-identified data and replication code for a digital-body-image study. Linked ICPSR repository requires JavaScript for inspection; raw photo contents were not verified. | No matching labeled pinch-photo dataset established. |

## Search coverage

- General web and primary research searches for skinfold/pinch photographs,
  image datasets, measured thickness, calipers, computer vision, and photogrammetry.
- Repository-focused searches for Zenodo, Mendeley Data, Figshare, and Roboflow.
- Hugging Face public dataset API: `skinfold` returned no repositories;
  `torsobf` returned the gated torso dataset above.
- GitHub repository API: `skinfold image` returned zero repositories;
  `skinfold dataset` returned five tabular diabetes-related projects;
  `pinch bodyfat` returned the PinchTest application.

These queries have limited coverage; private datasets, unindexed collections,
or author-held study images could exist. No access conditions were accepted,
no account information was submitted, and no researchers were contacted.

## Practical route to training

Use the existing app to export projected-width measurements with stable participant
codes, and pair them with real caliper readings from a standardized collection
procedure. The current training command and schema are documented in
[algorithm/README.md](../../algorithm/README.md).

An existing research group's consented, shareable pinch-photo/caliper collection
would also work after inspecting its measurement protocol, labels, permission,
and participant split. Do not replace missing measurements with visual guesses,
AI-generated labels, synthetic bodies, or unverified social-media estimates.

The implementation's minimum record count is a development guard only. After
training, independent testing is still required before claiming body-fat accuracy.
