import hmac
import os
import threading
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from .bodyfat import PROTOCOLS, estimate_body_fat
from .calibration import CalibrationStore
from .geometry import projected_width_mm
from .vision import HandAnalyzer
from .torso_model import TorsoPredictor
from .torso_vision import TorsoAnalyzer

ROOT = Path(__file__).resolve().parent
app = FastAPI(title='Local Pinch Analysis', docs_url=None, redoc_url=None, openapi_url=None)
hand_analyzer = HandAnalyzer(ROOT / 'models/hand_landmarker.task')
calibrations = CalibrationStore(os.environ.get('SCAN_CALIBRATION_MODEL', ROOT / 'models/calibration.json'))
def configured_torso_path():
    if os.environ.get('SCAN_TORSO_MODEL'):
        return Path(os.environ['SCAN_TORSO_MODEL'])
    import json
    settings = ROOT / 'model-config.json'
    if settings.is_file():
        relative = json.loads(settings.read_text(encoding='utf-8')).get('torso_model_dir', 'models/torso')
        resolved = (ROOT / relative).resolve()
        if not resolved.is_relative_to((ROOT / 'models').resolve()):
            raise ValueError('Configured torso model must be inside algorithm/models.')
        return resolved
    return ROOT / 'models/torso'


torso_predictor = TorsoPredictor(configured_torso_path())
torso_analyzer = TorsoAnalyzer(ROOT / 'models/pose_landmarker_lite.task')
torso_lock = threading.Lock()
bearer = HTTPBearer(auto_error=False)


def authenticate(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    expected = os.environ.get('SCAN_API_TOKEN', '')
    if not expected:
        raise HTTPException(503, 'Start the analysis service with npm start so a session token is configured.')
    if not credentials or not hmac.compare_digest(credentials.credentials, expected):
        raise HTTPException(401, 'Analysis session expired. Restart the app from the current QR code.')


@app.middleware('http')
async def limit_body(request: Request, call_next):
    # Reject unauthenticated image requests before reading their bodies.
    if request.url.path != '/health':
        expected = os.environ.get('SCAN_API_TOKEN', '')
        supplied = request.headers.get('authorization', '')
        if not expected or not hmac.compare_digest(supplied, f'Bearer {expected}'):
            return JSONResponse({'detail': 'Analysis session expired. Reopen the current project.'}, status_code=401)
    chunks, length = [], 0
    async for chunk in request.stream():
        length += len(chunk)
        if length > 12_000_000:
            return JSONResponse({'detail': 'Photograph exceeds the request limit.'}, status_code=413)
        chunks.append(chunk)
    request._body = b''.join(chunks)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    image_base64: str = Field(min_length=1, max_length=11_000_000)
    site: Literal['chest', 'abdomen', 'thigh', 'triceps', 'suprailiac']
    reference_mm: float = Field(ge=5, le=40)
    points: list[tuple[float, float]] | None = Field(default=None, min_length=4, max_length=4)


class EstimateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    equation: Literal['male', 'female']
    age: int = Field(ge=18, le=61)
    source: Literal['caliper', 'camera']
    measurements: dict[str, list[float]] = Field(max_length=3)


class TorsoRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    image_base64: str = Field(min_length=1, max_length=11_000_000)
    age: int = Field(ge=18, le=99)
    male_population_confirmed: Literal[True]


@app.get('/health')
def health():
    return {'status': 'ok', 'hand_model_ready': hand_analyzer.model_path.exists(),
            'calibrated_sites': sorted(calibrations.sites), 'camera_results': 'experimental',
            'torso_model': torso_predictor.info()}


@app.post('/torso', dependencies=[Depends(authenticate)])
def analyze_torso(payload: TorsoRequest):
    if not torso_predictor.ready:
        raise HTTPException(503, torso_predictor.info()['message'])
    try:
        with torso_lock:
            image, details = torso_analyzer.crop(payload.image_base64)
            if image is None:
                return details
            return {**torso_predictor.predict(image), **details}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@app.post('/analyze', dependencies=[Depends(authenticate)])
def analyze(payload: AnalyzeRequest):
    try:
        result = hand_analyzer.analyze(payload.image_base64)
        result['thickness_mm'] = None
        if result['status'] == 'retake' or payload.points is None:
            return result
        feature = projected_width_mm(payload.points, result['width'], result['height'], payload.reference_mm)
        return {**result, 'projected_fold_width_mm': round(feature, 2),
                **calibrations.predict(payload.site, feature)}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@app.post('/estimate', dependencies=[Depends(authenticate)])
def estimate(payload: EstimateRequest):
    if payload.source == 'camera' and any(site not in calibrations.sites for site in PROTOCOLS[payload.equation]):
        raise HTTPException(409, 'Camera calibration is missing for one or more required sites. No percentage was calculated.')
    try:
        result = estimate_body_fat(payload.equation, payload.age, payload.measurements)
        return {**result, 'source': payload.source, 'experimental': payload.source == 'camera'}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
