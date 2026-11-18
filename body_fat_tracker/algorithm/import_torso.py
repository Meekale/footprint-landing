"""Import authorized torso images and explicit label provenance into one format."""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

AUTO_ID = 'MasterMIARFID/gold_label_male_torso_dataset'
DEXA_ID = 'Sariax/MasterMIARFID_torsobf_dexa'


def export_dataset(rows, output, metadata):
    output = Path(output).resolve()
    if (output / 'manifest.json').exists():
        raise ValueError('Choose a new output directory; do not overwrite a reviewed dataset.')
    images = output / 'images'
    images.mkdir(parents=True, exist_ok=True)
    samples = []
    for index, row in enumerate(rows):
        label = float(row['label_percent'])
        if not 2 <= label <= 60:
            raise ValueError('Dataset contains an invalid body-fat label.')
        if isinstance(row['image'], bytes):
            source = io.BytesIO(row['image'])
        else:
            source = row['image']
        with Image.open(source) as image:
            normalized = ImageOps.exif_transpose(image).convert('RGB')
            normalized.save(images / f'{index:05}.jpg', quality=95)
        person = row.get('participant_id')
        person = hashlib.sha256(str(person).encode()).hexdigest()[:20] if person else None
        samples.append({'image': f'images/{index:05}.jpg', 'label_percent': label, 'participant_id': person})
    manifest = {**metadata, 'schema_version': 1, 'view': 'front_torso', 'population': 'male', 'samples': samples}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2, allow_nan=False), encoding='utf-8')
    print(f'Imported {len(samples)} actual labeled photographs. Label source: {metadata["label_source"]}')
    print(f'Manifest: {output / "manifest.json"}')


def read_local(args):
    root = args.directory.resolve()
    metadata_file = args.labels or root / ('metadata.jsonl' if args.source == 'hf-dexa' else 'Labels.csv')
    if args.source == 'hf-dexa':
        rows = [json.loads(line) for line in metadata_file.read_text(encoding='utf-8').splitlines() if line.strip()]
    else:
        with metadata_file.open(encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source))
    result = []
    for row in rows:
        name = str(row[args.image_field])
        if not Path(name).suffix:
            name += '.jpg'
        image = (root / name).resolve()
        if not image.is_relative_to(root) or not image.is_file():
            raise ValueError(f'Image must exist within the authorized data directory: {name}')
        result.append({'image': image, 'label_percent': row[args.label_field],
                       'participant_id': row.get(args.participant_field) if args.participant_field else None})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=['reddit', 'hf-auto', 'hf-dexa'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--directory', type=Path)
    parser.add_argument('--labels', type=Path)
    parser.add_argument('--image-field', default='image')
    parser.add_argument('--label-field', default='bodyfat')
    parser.add_argument('--participant-field')
    parser.add_argument('--license', help='Actual permission/license supplied with local Reddit files; do not invent one.')
    parser.add_argument('--noncommercial-research', action='store_true')
    args = parser.parse_args()
    if args.source == 'hf-auto':
        if not args.noncommercial_research:
            parser.error('This dataset is CC BY-NC 4.0. Use --noncommercial-research only for that permitted use.')
        import pyarrow.parquet as pq
        info = json.load(urllib.request.urlopen(f'https://huggingface.co/api/datasets/{AUTO_ID}', timeout=30))
        revision = info['sha']
        url = f'https://huggingface.co/datasets/{AUTO_ID}/resolve/{revision}/data/train-00000-of-00001.parquet'
        with urllib.request.urlopen(url, timeout=90) as source:
            raw = source.read()
        table = pq.read_table(io.BytesIO(raw))
        rows = [{'image': row['image']['bytes'], 'label_percent': row['wbfp']} for row in table.to_pylist()]
        metadata = {'dataset_id': AUTO_ID, 'source_url': f'https://huggingface.co/datasets/{AUTO_ID}',
                    'revision': revision, 'download_sha256': hashlib.sha256(raw).hexdigest(),
                    'label_source': 'auto_labeled', 'license': 'cc-by-nc-4.0',
                    'label_note': 'EfficientNet teacher predictions, not measured DXA or Reddit crowd labels.',
                    'intended_use': 'noncommercial_research'}
    else:
        if not args.directory:
            parser.error('--directory is required for already-authorized local data.')
        if args.source == 'reddit' and not args.license:
            parser.error('The Reddit repository declares no license. Obtain usage permission and record it with --license.')
        rows = read_local(args)
        metadata = {
            'dataset_id': DEXA_ID if args.source == 'hf-dexa' else 'local-reddit-torso-data',
            'source_url': f'https://huggingface.co/datasets/{DEXA_ID}' if args.source == 'hf-dexa'
              else 'https://github.com/Kayse-Johnson/Body-Fat-Regression-from-Reddit-Image-Dataset',
            'label_source': 'reported_dexa' if args.source == 'hf-dexa' else 'reddit_visual',
            'license': args.license or 'mit',
        }
    export_dataset(rows, args.output, metadata)


if __name__ == '__main__':
    main()
