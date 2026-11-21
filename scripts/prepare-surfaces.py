"""Rebuild the local metric surface maps from their CC0 originals (Pillow + NumPy)."""
import argparse
import hashlib
import io
import json
import subprocess
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image


OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'textures' / 'interior'
# Width is the on-disk target width. Textiles retain their source aspect ratios.
MATERIALS = {
    'oak_veneer_01': 1024, 'natural_walnut_veneer': 1024,
    'Travertine001': 1024, 'rough_linen': 640, 'wool_boucle': 640,
    'white_plaster_02': 512, 'leather_red_02': 640,
}
CHANNELS = ('Diffuse', 'Rough', 'Displacement')


def fetch(url, path):
    if not path.exists():
        part = path.with_name(path.name + '.part')
        subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '90',
                        '--user-agent', 'Azur-interior-materials/1.0', url, '-o', str(part)], check=True)
        part.replace(path)
    return path


def source_images(asset, cache):
    if asset == 'Travertine001':
        label = asset + '_1K-JPG'
        archive = fetch('https://ambientcg.com/get?file=' + label + '.zip', cache / (label + '.zip'))
        with zipfile.ZipFile(archive) as pack:
            return [Image.open(io.BytesIO(pack.read(f'{label}_{kind}.jpg'))).convert('L')
                    for kind in ('Color', 'Roughness', 'Displacement')]
    listing = fetch('https://api.polyhaven.com/files/' + asset, cache / (asset + '-files.json'))
    entries = json.loads(listing.read_bytes())
    images = []
    for kind in CHANNELS:
        key = 'coll1' if asset == 'leather_red_02' and kind == 'Diffuse' else kind
        file = entries[key]['1k']['jpg']
        path = fetch(file['url'], cache / f'{asset}-{kind}.jpg')
        if hashlib.md5(path.read_bytes()).hexdigest() != file['md5']:
            raise ValueError(f'Upstream checksum mismatch in {path.name}')
        images.append(Image.open(path).convert('L'))
    return images


def encode(data):
    """Store variation around the median; retain highlights above the typical range."""
    low, mid, high = np.percentile(data, (2, 50, 98))
    # A nearly flat displacement scan is nearly flat in the finished material too.
    radius = max(mid - low, high - mid, 7)
    return np.clip(0.5 + (data - mid) / (radius * 2.4), 0, 1)


def prepare(asset, width, cache):
    maps = source_images(asset, cache)
    if asset == 'natural_walnut_veneer':
        maps = [im.transpose(Image.Transpose.ROTATE_90) for im in maps]
    size = width, round(width * maps[0].height / maps[0].width)
    albedo, rough, height = [encode(np.asarray(im.resize(size, Image.Resampling.LANCZOS), dtype='float32')) for im in maps]
    if asset == 'wool_boucle':
        # Remove the dyed check's color contrast but retain the relief of the looped yarn.
        albedo = height * .80 + albedo * .20
    # Lossless WebP keeps packed channels independent. Six bits of height resolve
    # 0.04 mm even on the heaviest textile.
    levels = np.array([63, 31, 63], dtype='float32')
    packed = np.rint(np.stack((albedo, rough, height), axis=-1) * levels) / levels
    target = OUTPUT / (asset + '.webp')
    Image.fromarray(np.rint(packed * 255).astype('uint8')).save(target, lossless=True, method=5)
    print(f'{target.name}: {size[0]} × {size[1]}, {target.stat().st_size // 1024} KiB')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True, help='Local cache directory for the original maps')
    cache_dir = parser.parse_args().cache
    cache_dir.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, target_width in MATERIALS.items():
        prepare(name, target_width, cache_dir)
