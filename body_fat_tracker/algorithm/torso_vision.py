"""Check body visibility and crop the torso; never infer sex or identity."""
import threading
from pathlib import Path

import numpy as np

from .vision import decode_photo, photo_quality


class TorsoAnalyzer:
    def __init__(self, model_path):
        self.model_path = Path(model_path)
        self.detector = None
        self.lock = threading.Lock()

    def crop(self, encoded):
        image = decode_photo(encoded)
        quality = photo_quality(image)
        if not 35 <= quality['brightness'] <= 235 or quality['sharpness'] < 20:
            return None, {'status': 'retake', 'estimate_percent': None,
                          'message': 'Use even lighting and hold the camera still until the image is sharp.'}
        if not self.model_path.exists():
            raise RuntimeError('Body visibility model is missing. Run python -m algorithm.download_torso_models.')
        import mediapipe as mp
        with self.lock:
            if self.detector is None:
                self.detector = mp.tasks.vision.PoseLandmarker.create_from_options(
                    mp.tasks.vision.PoseLandmarkerOptions(
                        base_options=mp.tasks.BaseOptions(model_asset_path=str(self.model_path)),
                        running_mode=mp.tasks.vision.RunningMode.IMAGE,
                        num_poses=2, min_pose_detection_confidence=.6,
                        min_pose_presence_confidence=.6,
                    )
                )
            reduced = image.copy(); reduced.thumbnail((1280, 1280))
            result = self.detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(reduced)))
        if len(result.pose_landmarks) != 1:
            return None, {'status': 'retake', 'estimate_percent': None,
                          'message': 'Show one person facing the camera, with shoulders, hips and upper thighs visible.'}
        landmarks = result.pose_landmarks[0]
        shoulders = [landmarks[11], landmarks[12]]
        hips = [landmarks[23], landmarks[24]]
        if any(point.visibility < .5 or not 0 <= point.x <= 1 or not 0 <= point.y <= 1 for point in shoulders + hips):
            return None, {'status': 'retake', 'estimate_percent': None,
                          'message': 'Keep both shoulders and hips clearly visible, with arms slightly away from the torso.'}
        shoulder_y = sum(point.y for point in shoulders) / 2
        hip_y = sum(point.y for point in hips) / 2
        torso_height = hip_y - shoulder_y
        torso_width = abs(shoulders[0].x - shoulders[1].x)
        if torso_height < .12 or torso_width < .10 or abs(shoulders[0].y - shoulders[1].y) > torso_height * .3:
            return None, {'status': 'retake', 'estimate_percent': None,
                          'message': 'Stand upright facing forward. Keep the camera level and the torso large in the frame.'}
        left = max(0, min(point.x for point in shoulders + hips) - torso_width * .15)
        right = min(1, max(point.x for point in shoulders + hips) + torso_width * .15)
        top = max(0, shoulder_y - torso_height * .1)
        bottom = min(1, hip_y + torso_height * .25)
        width, height = image.size
        crop = image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))
        if min(crop.size) < 180:
            return None, {'status': 'retake', 'estimate_percent': None,
                          'message': 'Move closer while keeping shoulders and hips in view.'}
        return crop, {'quality': quality, 'crop': [left, top, right, bottom]}
