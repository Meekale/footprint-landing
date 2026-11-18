# Body Fat Tracker

An Expo SDK 58 JavaScript app with a Python torso-photo analysis service.
Use Expo Go with SDK 58 support and sign Expo CLI and Expo Go into the same account.

## Torso photos

The app opens directly to the torso-photo flow. Pinch camera scans and manual
caliper readings have been removed from the app.

1. Enter your adult age and confirm the experimental model's training population.
2. Choose **Choose from photo library** or **Take a photo**. Library import does
   not require camera permission.
3. Drag to position and pinch or use zoom buttons to adjust size. Choose Portrait,
   Square, Landscape, or Original proportions. Rotate, flip, or recenter as needed.
   Keep shoulders, hips, and upper thighs visible.
4. Tap **Use this crop**, review it, then **Analyze this photo**. **Adjust crop,
   zoom & rotation** reopens the editor with the original working image and crop.
   Canceling an edit keeps the previous photo and result.

Only the approved crop is uploaded when Analyze is tapped. Editing uses temporary
app-cache copies and never modifies the library original. Images are normalized
to JPEG, capped at 3072 pixels for editing and 1600 pixels for upload. Crops with
a shorter side below 400 pixels are rejected instead of upscaled.

The trained ResNet-18-feature regression head uses the user-approved 299-image
auto-labeled male-torso dataset. Results are **experimental appearance estimates,
not measured body-fat percentages**, for noncommercial research. See
[model details and replacement instructions](algorithm/TORSO_MODEL.md) and
[the training report](docs/research/2026-10-27-torso-training-report.md).

## Run

The Python environment and model artifacts are installed in this workspace.

```powershell
npm run start:tunnel
```

Keep the terminal open and scan its QR code on a physical iPhone. If needed, use
`npx expo login` and `npx expo whoami` to check the computer's Expo account.
`npm start` uses LAN instead; phone and computer must be reachable on the same
network. Stop the old session with Ctrl+C before starting another. Ports 8765
and 8081 should be available. `npm run ios` requires a Mac.

## Fresh setup

Use Python 3.10 through 3.12 and Node.js 22.13 or newer on the Node 22 line.

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r algorithm/requirements.txt -r algorithm/requirements-torso.txt
.\.venv\Scripts\python.exe -m algorithm.download_model
.\.venv\Scripts\python.exe -m algorithm.download_torso_models
```

The trained weights and datasets are ignored by Git. Follow the torso-model
instructions to import the authorized dataset, train, and select an artifact;
a fresh checkout without weights correctly reports an unavailable model.
On macOS/Linux, use `.venv/bin/python` instead of the Windows Python path.

## Data handling

Uploads travel through the development tunnel to this computer. Python processes
photos in memory without image persistence or access logging. The app removes
its temporary photo copies when replaced, discarded, or unmounted; OS caches,
interrupted sessions, backups, and tunnel transport are outside that guarantee.
The app does not save edits back to the photo library.

Python binds to `127.0.0.1:8765`. Metro proxies analysis routes under
`/bodyfat-api`, including `/health` and `/torso`. A random session bearer token
gates POSTs. It is bundled into the development app and is development access
control, not production authentication. Legacy pinch/caliper backend utilities
remain for research, with no app screens or navigation to them.

## Verification

```powershell
npm run test:crop
.\.venv\Scripts\python.exe -m unittest discover -s algorithm/tests -v
npm run check
npx expo export --platform ios
```

Crop tests cover pixel coordinates, pan bounds, viewport resizing, aspect ratios,
and minimum image detail. Native photo selection, multi-touch gestures, rotation,
camera capture, and background/resume still require physical-iPhone testing.
Build success does not establish body-fat accuracy.
