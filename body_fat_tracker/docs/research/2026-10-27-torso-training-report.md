# Temporary torso-photo model: actual training report

## Source decision

The user requested the Reddit baseline followed by replacement with the pending
DXA dataset. Inspection found no published Reddit images, Labels.csv, or trained
checkpoint. The source points into a Drive folder that redirects to sign-in.
The user then explicitly approved the separate public auto-labeled dataset for
temporary noncommercial training. The trained model is **not Reddit-trained**.

Dataset: [MasterMIARFID/gold_label_male_torso_dataset](https://huggingface.co/datasets/MasterMIARFID/gold_label_male_torso_dataset).
The publisher describes 299 male frontal-torso photographs with labels generated
by an EfficientNet teacher. The labels are model predictions, not measured body
fat. Source license: CC BY-NC 4.0. Retain attribution and noncommercial restrictions.

- Source revision: `331ad1572ebadca22f02f90f93453b5592292c29`
- Download SHA256: `2b302aa0159ce912c1e6fea54d65516b4fdb41105bbdc3daddfdce5a995f64d4`
- Actual training timestamp: `2026-10-27T02:12:05.550513+00:00`
- Dataset imported under ignored `algorithm/data/torso-auto/`.

## Training performed

The official pretrained ImageNet ResNet-18 stays frozen. RGB images are letterboxed
to 224 × 224 with ImageNet normalization. Its 512 features feed a learned ridge
regression head. Feature normalization uses training samples only. Validation
selected alpha 1000 from five predefined candidates. No synthetic labels were
used in this training run.

Near-duplicate grouping produced 298 groups from 299 images. Seed 42 assigned:

| Partition | Images | Use |
| --- | ---: | --- |
| Training | 179 | Fit normalization and regression coefficients |
| Validation | 45 | Select regularization |
| Calibration | 30 | Describe held-out label residual spread |
| Test | 45 | Final label-agreement evaluation |

Participant identifiers are absent. Duplicate grouping reduces obvious image
leakage but cannot establish that different photographs of one person are kept
together. These are image counts, not verified distinct-person counts.

## Measured results

All errors below are in percentage points **against the automatic labels**.
They do not measure error against actual body fat or DXA.

| Test metric | Trained model | Training-mean baseline |
| --- | ---: | ---: |
| MAE | 3.629 | 5.202 |
| RMSE | 4.645 | 6.435 |
| Bias, predicted minus label | -2.108 | -1.392 |

The calibration partition's 90th-percentile absolute label residual was 9.565
points. The UI identifies the resulting spread as a source-label comparison,
not a confidence interval for a person's true body fat. This broad spread is
not narrowed or hidden to make the prototype appear more accurate.

## Actual artifacts

Model directory: ignored `algorithm/models/torso-auto/`.

- `head.npz`: learned normalization and numeric regression parameters.
- `backbone.pth`: official pretrained ResNet-18 tensors.
- `model.json`: source, preprocessing, split, metrics, limitations, checksums.
- `split-audit.json`: hashed-image group and partition assignments.

Head SHA256: `b10b748c4a2542a0fb2edd1c0e37f5ed7ca169cae9eaca0143d38dd331e9a911`.
Backbone SHA256: `f37072fd47e89c5e827621c5baffa7500819f7896bbacec160b1a16c560e07ec`.

The configured Python service loads this directory. The app opens the torso-photo
mode first and identifies its actual label source. Existing pinch and caliper
workflows remain available separately. The trained artifact produced a numeric
appearance estimate through body-pose detection, torso cropping, feature extraction,
and regression during local integration testing.

## Limits and next dataset

The source contains posed, often muscular male-torso imagery, including stock
watermarks and variable crops. Source-label agreement may reflect appearance or
photographic shortcuts. Relaxed phone photographs are a domain shift. Female
populations, clinical accuracy, independent-person performance, and longitudinal
tracking have not been validated. Body visibility checks do not establish body-fat
accuracy or guarantee that every unsupported image will be rejected.

When DXA access is granted, verify label provenance, framing, permissions, and
participant information, and train a fresh head with its own held-out evaluation.
Do not mix the old automatically labeled test set with DXA evaluation or silently
rename the old labels. The same manifest format and camera/API interface support
the replacement; `SCAN_TORSO_MODEL` or `algorithm/model-config.json` selects it.
