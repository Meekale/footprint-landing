// Pure image/viewport geometry shared by the native editor and Node tests.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function frameFor(canvas, ratio) {
  if (![canvas.width, canvas.height, ratio].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('A valid canvas and crop ratio are required.');
  }
  const width = Math.min(Math.max(1, canvas.width - 32), Math.max(1, canvas.height - 32) * ratio);
  const height = width / ratio;
  return { width, height, left: (canvas.width - width) / 2, top: (canvas.height - height) / 2 };
}

function imageLayout(source, canvas, ratio, transform = {}) {
  if (![source.width, source.height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('The photograph has invalid dimensions.');
  }
  const frame = frameFor(canvas, ratio);
  const baseScale = Math.max(frame.width / source.width, frame.height / source.height);
  const zoom = clamp(Number.isFinite(transform.zoom) ? transform.zoom : 1, 1, 6);
  const scale = baseScale * zoom;
  const width = source.width * scale, height = source.height * scale;
  const x = clamp(Number.isFinite(transform.x) ? transform.x : 0, -(width - frame.width) / 2, (width - frame.width) / 2);
  const y = clamp(Number.isFinite(transform.y) ? transform.y : 0, -(height - frame.height) / 2, (height - frame.height) / 2);
  return { frame, zoom, x, y, scale, width, height,
    left: (canvas.width - width) / 2 + x, top: (canvas.height - height) / 2 + y };
}

function pixelCrop(source, canvas, ratio, transform) {
  const layout = imageLayout(source, canvas, ratio, transform);
  const originX = clamp(Math.round((layout.frame.left - layout.left) / layout.scale), 0, source.width - 1);
  const originY = clamp(Math.round((layout.frame.top - layout.top) / layout.scale), 0, source.height - 1);
  return {
    originX, originY,
    width: Math.min(source.width - originX, Math.max(1, Math.round(layout.frame.width / layout.scale))),
    height: Math.min(source.height - originY, Math.max(1, Math.round(layout.frame.height / layout.scale))),
  };
}

function restoreCrop(source, canvas, ratio, crop) {
  if (!crop) return { zoom: 1, x: 0, y: 0 };
  const base = imageLayout(source, canvas, ratio);
  const scale = base.frame.width / crop.width;
  const candidate = {
    zoom: scale / base.scale,
    x: (source.width / 2 - crop.originX - crop.width / 2) * scale,
    y: (source.height / 2 - crop.originY - crop.height / 2) * scale,
  };
  const restored = imageLayout(source, canvas, ratio, candidate);
  return { zoom: restored.zoom, x: restored.x, y: restored.y };
}

function outputSize(crop, maxSide = 1600) {
  const factor = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  const size = { width: Math.max(1, Math.round(crop.width * factor)), height: Math.max(1, Math.round(crop.height * factor)) };
  if (Math.min(size.width, size.height) < 400) {
    throw new Error('This crop is too small for analysis. Zoom out, use a portrait crop, or choose a higher-resolution photo.');
  }
  return size;
}

module.exports = { frameFor, imageLayout, pixelCrop, restoreCrop, outputSize };
