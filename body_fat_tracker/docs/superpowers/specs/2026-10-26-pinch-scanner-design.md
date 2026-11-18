# Calibrated pinch scanner

The user approved implementing the researched design and confirmed there are no
labeled photographs yet. Build a calibration-ready prototype, not a fabricated
photo-to-body-fat predictor. Keep the Expo SDK 58 JavaScript app and use Python
for image analysis, calibration training, and the published body-fat equation.

The camera takes an explicit photograph, runs Google's pretrained MediaPipe Hand
Landmarker, and checks image quality. The user marks a measured fingernail-width
reference and two visible fold edges on the photograph. Their ratio supplies a
projected width, not a caliper reading. The service returns `needs_calibration`
unless a fitted, site-specific calibration model exists and the measurement is
within its training range. The app never treats MediaPipe world coordinates or
finger separation as a physical ruler. Hand outlines guide framing only.

A three-site workflow collects three independent pinches per site. Published
Jackson-Pollock three-site density equations and the Siri conversion provide an
estimated body-fat percentage from either real caliper readings or fitted camera
measurements. Keep these modes separate. Camera-derived results remain explicitly
experimental. Reject missing sites, inconsistent repeats, unsupported ages,
non-finite values, and extrapolation. No default or randomly generated percentage.

Images are processed in memory and deleted from the phone cache after review.
The Python service binds to loopback, requires a session bearer token, limits
image size, and is reachable from the phone through a restricted Metro proxy
on the existing approved development tunnel. The development token is bundled
into this private development app; this is not production authentication.
No image logging, cloud inference, or automatic dataset collection.

Training consumes an explicitly supplied CSV with participant identifiers,
sites, projected fold widths, and real caliper readings. Hold out participants,
record validation errors and supported ranges, and save a versioned JSON model.
Never train on synthetic labels and present them as real measurements.
