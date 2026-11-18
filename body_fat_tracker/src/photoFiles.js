import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Only remove app-owned cache files, never ph:// assets or the user's library originals.
export function removeTemporaryPhoto(photo) {
  const uri = typeof photo === 'string' ? photo : photo?.uri;
  const prefix = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  if (!uri?.startsWith(prefix)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch {}
}

export async function normalizePhoto(asset) {
  if (!asset?.uri) throw new Error('The selected photo could not be opened.');
  let context = ImageManipulator.manipulate(asset.uri);
  let image;
  try {
    image = await context.renderAsync();
    const longest = Math.max(image.width, image.height);
    if (longest > 3072) {
      const resized = ImageManipulator.manipulate(image);
      resized.resize(image.width >= image.height ? { width: 3072 } : { height: 3072 });
      let next;
      try { next = await resized.renderAsync(); }
      catch (failure) { resized.release?.(); throw failure; }
      image.release?.(); context.release?.();
      image = next; context = resized;
    }
    if (Math.min(image.width, image.height) < 400) {
      throw new Error('Choose a higher-resolution photo, at least 400 pixels on its shorter side.');
    }
    return await image.saveAsync({ format: SaveFormat.JPEG, compress: .95 });
  } finally {
    image?.release?.(); context.release?.();
  }
}
