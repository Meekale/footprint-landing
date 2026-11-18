"""Download official generic vision models; these are not trained body-fat heads."""
import hashlib
import json
import urllib.request
from pathlib import Path

from .torso_model import BACKBONE_URL

POSE_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'


def main():
    root = Path(__file__).resolve().parent / 'models'
    targets = [(root / 'torso-backbone/resnet18.pth', BACKBONE_URL),
               (root / 'pose_landmarker_lite.task', POSE_URL)]
    for file, url in targets:
        file.parent.mkdir(parents=True, exist_ok=True)
        if not file.exists():
            temporary = file.with_suffix('.download')
            urllib.request.urlretrieve(url, temporary)
            temporary.replace(file)
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        if file.suffix == '.pth' and not digest.startswith('f37072fd'):
            raise RuntimeError('Official ResNet-18 checkpoint hash does not match.')
        file.with_suffix(file.suffix + '.source.json').write_text(json.dumps({
            'source': url, 'sha256': digest, 'bytes': file.stat().st_size,
        }, indent=2), encoding='utf-8')
        print(f'Generic model ready: {file.name}')


if __name__ == '__main__':
    main()
