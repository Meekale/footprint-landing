# Torso-photo model and dataset replacement

## Current state

The replaceable training and inference pipeline is implemented, and the user-approved
auto-labeled experiment has been trained and selected in `algorithm/model-config.json`.
Its learned head is stored under ignored `algorithm/models/torso-auto/`. Generic
ImageNet ResNet-18 and Google MediaPipe Pose Landmarker provide the vision backbone
and body-visibility check. The result is an experimental appearance estimate.

The requested [Reddit project](https://github.com/Kayse-Johnson/Body-Fat-Regression-from-Reddit-Image-Dataset)
publishes only Python/notebook source. Its images and `Labels.csv` are referenced
in a Google Drive path that redirects to sign-in. There are no published release
checkpoints and no declared repository license. No inaccessible files were fetched,
no code from that unlicensed project was copied, and no image labels were invented.

An optional public alternative is
[MasterMIARFID/gold_label_male_torso_dataset](https://huggingface.co/datasets/MasterMIARFID/gold_label_male_torso_dataset):
299 male-torso photographs with EfficientNet-generated labels, CC BY-NC 4.0.
Those labels are teacher predictions, not Reddit crowd estimates or actual DXA
measurements. The user explicitly approved this temporary noncommercial source.
See [the actual training report](../docs/research/2026-10-27-torso-training-report.md)
for the dataset revision, split, held-out metrics, and limits.

## Model architecture

- Frozen torchvision ResNet-18, using the official ImageNet-1K pretrained checkpoint.
- RGB letterbox to 224 × 224, ImageNet normalization; retain aspect ratio.
- 512 image features, a ridge-regression head with standardization fitted on training only.
- Regularization selected from 1, 10, 100, 1000, 10000 on validation only.
- Train/validation/calibration/test groups: 60% / 15% / 10% / 15%, seed 42.
- Known participant IDs and perceptual duplicate clusters cannot cross splits.
  If identities are missing, subject-independent evaluation is not established.
- A separate calibration partition supplies a descriptive 90th-percentile absolute
  error spread against source labels. It is not a physiological confidence interval.
- Untouched test-label MAE, RMSE and bias are compared with a training-mean baseline.

The initial importer/predictor supports frontal male-torso images only. It is not
a whole-body multi-view model and does not infer sex, identity, visceral fat, or
fat distribution from a face. Phone inference checks pose visibility and crops
to the torso. Dataset-crop test performance does not establish real phone-capture
performance or medical accuracy.

## Environment

```powershell
.\.venv\Scripts\python.exe -m pip install -r algorithm/requirements-torso.txt
.\.venv\Scripts\python.exe -m algorithm.download_torso_models
```

Training is practical on CPU because the pretrained backbone stays frozen.

## Import the original Reddit files if provided

Place the authorized image collection and matching CSV under an ignored data
directory. The importer never scrapes Reddit or accesses the project's private
Drive files. Record the actual permission/license supplied by the dataset owner.
Inspect the CSV headers and choose the corresponding image, label and participant
fields; omit `--participant-field` only when identities genuinely are unavailable.

```powershell
.\.venv\Scripts\python.exe -m algorithm.import_torso --source reddit --directory algorithm/data/reddit-original --labels algorithm/data/reddit-original/Labels.csv --image-field image --label-field bodyfat --participant-field participant_id --license "permission supplied by dataset owner" --output algorithm/data/reddit-import
.\.venv\Scripts\python.exe -m algorithm.train_torso --manifest algorithm/data/reddit-import/manifest.json --output algorithm/models/torso-reddit
```

The quoted permission text above must describe actual granted permission; the
argument itself does not grant rights. Without the image/CSV files, this command
cannot train a model.

## Optional public auto-labeled experiment

Only run this after agreeing to that source and noncommercial research use:

```powershell
.\.venv\Scripts\python.exe -m algorithm.import_torso --source hf-auto --noncommercial-research --output algorithm/data/torso-auto
.\.venv\Scripts\python.exe -m algorithm.train_torso --manifest algorithm/data/torso-auto/manifest.json --output algorithm/models/torso-auto
```

Import pins the source repository revision and records a download hash. It does
not use Hugging Face credentials or accept gated terms. Keep source attribution
and CC BY-NC restrictions with this experiment; do not ship it commercially.

## Replace with the pending DXA dataset

After the dataset owner grants access, download the authorized image directory
and its metadata using your own account. The importer reads those local files
without handling access tokens. Check actual metadata field names before use;
the following command is for metadata using `file_name` and `wbfp`.

```powershell
.\.venv\Scripts\python.exe -m algorithm.import_torso --source hf-dexa --directory algorithm/data/authorized-dexa --labels algorithm/data/authorized-dexa/metadata.jsonl --image-field file_name --label-field wbfp --output algorithm/data/torso-dexa
.\.venv\Scripts\python.exe -m algorithm.train_torso --manifest algorithm/data/torso-dexa/manifest.json --output algorithm/models/torso-dexa
```

Participant IDs should be mapped with `--participant-field` if provided. Check
label provenance, subject overlap with prior data, source conditions, framing,
and supported populations before interpreting results. The pipeline records
`reported_dexa`, not independently verified clinical ground truth. Retraining
on a new source does not automatically establish accuracy on camera users.

## Select an actual trained artifact

Once training has succeeded and metrics/limitations have been reviewed:

```powershell
$env:SCAN_TORSO_MODEL = 'algorithm/models/torso-dexa'
npm run start:tunnel
```

Use `algorithm/models/torso-auto` or `algorithm/models/torso-reddit` for the
corresponding actual experiment. Restart the full service to load a different
artifact; do not overwrite active model files. Without an environment override,
`algorithm/model-config.json` selects the approved `models/torso-auto` directory.
A fresh checkout without the ignored weights correctly reports an unavailable model.

Artifacts contain `model.json`, `head.npz`, `backbone.pth`, and `split-audit.json`.
Checksums, shape validation, safe numeric loading, and `weights_only=True` are
used. Dataset provenance, held-out metrics, and identity limitations travel with
the model. The camera/API do not need to change when the source is replaced.

## Camera and API

The app opens directly to **Torso photo** and checks server model status before
enabling camera capture or library import. Both sources open the crop editor;
only the approved JPEG crop is sent when Analyze is tapped. Without an actual
trained head, it shows an unavailable model and refuses to invent a percentage.

`POST /bodyfat-api/torso` uses the existing session authentication and accepts
`image_base64`, an adult `age`, and `male_population_confirmed: true`.
Responses identify the exact training source and distinguish a source-label
spread from uncertainty about actual body fat. Existing pinch/caliper routes
remain separate.

Generic pretrained model sources:
- https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.resnet18.html
- https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python
