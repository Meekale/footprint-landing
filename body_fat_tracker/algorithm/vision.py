import base64
import binascii
import io
import threading
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 24_000_000


def decode_photo(encoded):
    if len(encoded) > 11_000_000:
        raise ValueError('Photograph is too large. Use the in-app camera capture.')
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 8_000_000:
            raise ValueError('Photograph exceeds 8 MB.')
        with Image.open(io.BytesIO(raw)) as source:
            source.load()
            image = ImageOps.exif_transpose(source).convert('RGB')
    except (binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError('Could not read the photograph. Capture it again.') from error
    if min(image.size) < 400:
        raise ValueError('Photograph is too small. Use a higher-resolution capture.')
    return image


def photo_quality(image):
    small = image.copy()
    small.thumbnail((1280, 1280))
    gray = cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2GRAY)
    return {'brightness': round(float(gray.mean()), 1),
            'sharpness': round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1)}


class HandAnalyzer:
    def __init__(self, model_path):
        self.model_path = Path(model_path)
        self._detector = None
        self._lock = threading.Lock()

    def _get_detector(self):
        if not self.model_path.exists():
            raise RuntimeError('Hand model not installed. Run the model download command in the README.')
        if self._detector is None:
            import mediapipe as mp
            self._detector = mp.tasks.vision.HandLandmarker.create_from_options(
                mp.tasks.vision.HandLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=str(self.model_path)),
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_hands=1,
                    min_hand_detection_confidence=.6,
                    min_hand_presence_confidence=.6,
                )
            )
        return self._detector

    def analyze(self, encoded):
        image = decode_photo(encoded)
        width, height = image.size
        quality = photo_quality(image)
        image.thumbnail((1280, 1280))
        rgb = np.asarray(image)
        mean, sharpness = quality['brightness'], quality['sharpness']
        common = {'width': width, 'height': height,
                  'quality': quality}
        # Heuristic capture gates, not clinical or model-accuracy thresholds.
        if mean < 35 or mean > 235:
            return {**common, 'status': 'retake', 'message': 'Use bright, even lighting without glare.', 'landmarks': []}
        if sharpness < 20:
            return {**common, 'status': 'retake', 'message': 'The photo looks blurred. Hold still and focus on the pinch.', 'landmarks': []}
        import mediapipe as mp
        with self._lock:
            result = self._get_detector().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        if not result.hand_landmarks:
            return {**common, 'status': 'retake',
                    'message': 'No clear hand found. Show your pinching hand, wrist and fingernail.', 'landmarks': []}
        landmarks = [{'x': float(p.x), 'y': float(p.y)} for p in result.hand_landmarks[0]]
        return {**common, 'status': 'hand_detected', 'landmarks': landmarks,
                'message': 'Hand detected. Mark your reference and the visible fold edges.'}
