"""Download Google's existing Hand Landmarker; no body-fat model is implied."""
import hashlib
import json
import urllib.request
from pathlib import Path

URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'


def main():
    directory = Path(__file__).resolve().parent / 'models'
    directory.mkdir(exist_ok=True)
    target = directory / 'hand_landmarker.task'
    temporary = target.with_suffix('.download')
    urllib.request.urlretrieve(URL, temporary)
    if temporary.stat().st_size < 1_000_000:
        temporary.unlink()
        raise RuntimeError('Downloaded checkpoint is unexpectedly small.')
    temporary.replace(target)
    provenance = {'source': URL, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'bytes': target.stat().st_size, 'purpose': 'hand detection only'}
    (directory / 'hand_landmarker.source.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
    print(f'Hand Landmarker ready: {target}')


if __name__ == '__main__':
    main()
