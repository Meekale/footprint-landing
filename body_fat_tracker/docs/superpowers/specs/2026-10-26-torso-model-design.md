# Replaceable torso-photo model

The user approved moving to a frontal torso/body-photo prototype, initially using
the Reddit project, followed by retraining with their pending Hugging Face DXA
dataset. This supersedes the earlier pinch-only restriction for this new mode.

Inspection of the Reddit repository found code only: no images, Labels.csv,
checkpoint, release assets, or declared license. Its referenced Drive location
redirects to Google sign-in. Do not claim that its model was trained locally.
Do not copy the unlicensed source. Implement independently using torchvision's
pretrained ResNet-18 and a regularized regression head.

A separate accessible HF dataset contains 299 auto-labeled male-torso images
under CC BY-NC 4.0. The user explicitly approved using it instead for this temporary noncommercial experiment. Its labels are predictions from an
EfficientNet teacher, not DXA measurements and not Reddit crowd estimates.

Use a versioned manifest recording image paths, label source, source URL, license,
and participant identifiers when available. Reject nonexistent images, nonfinite
labels, path escapes, and missing provenance. Detect exact/near image duplicates
and keep their groups together. If participant identities are absent, report
that a participant-independent test is not established; never infer identities
from faces. Split train, validation, calibration, and test before fitting anything.

Reuse frozen ImageNet ResNet-18 features; fit the regularized head on training
data, select regularization using validation only, derive a residual spread from
calibration only, and evaluate once against the untouched test labels. Compare
with a training-mean baseline. Report metrics as agreement with the dataset's
labels, not measured body-fat accuracy for weak-label sources.

Save safe numeric head arrays and official backbone tensors, with hashes and
metadata. Server startup selects a model directory. The API and camera screen
stay the same when retraining on a new source, but the provenance, population,
capture protocol, metrics, and license must be rechecked. DXA access alone does
not automatically promote a model to a clinically validated measurement.

Add a dedicated camera mode requiring no hand reference. Guide a front torso
photo from shoulders to upper thighs, process on the user's computer through the
already approved authenticated tunnel, and delete temporary capture files.
Reject unsupported capture quality/body visibility. No number appears unless
a trained artifact is loaded. Results identify their actual label source and
remain experimental. Preserve existing pinch and caliper modes.
