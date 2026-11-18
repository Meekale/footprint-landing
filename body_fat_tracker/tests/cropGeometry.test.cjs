const test = require('node:test');
const assert = require('node:assert/strict');
const { imageLayout, pixelCrop, restoreCrop, outputSize } = require('../src/cropGeometry');
const canvas = { width: 360, height: 480 };

test('portrait crop maps a wide image to the correct original pixel coordinates', () => {
  assert.deepEqual(pixelCrop({ width: 4000, height: 3000 }, canvas, .75, { zoom: 1, x: 0, y: 0 }),
    { originX: 875, originY: 0, width: 2250, height: 3000 });
});

test('dragging cannot expose empty space or move crop beyond image bounds', () => {
  const source = { width: 4032, height: 3024 };
  for (const x of [-100000, 0, 100000]) for (const y of [-100000, 0, 100000]) {
    const crop = pixelCrop(source, canvas, .75, { zoom: 3, x, y });
    assert.ok(crop.originX >= 0 && crop.originY >= 0);
    assert.ok(crop.originX + crop.width <= source.width);
    assert.ok(crop.originY + crop.height <= source.height);
  }
});

test('saved crop restores after viewport size changes', () => {
  const source = { width: 3000, height: 4000 };
  const crop = pixelCrop(source, canvas, .75, { zoom: 2, x: 70, y: -80 });
  const larger = { width: 430, height: 550 };
  const restored = restoreCrop(source, larger, .75, crop);
  const roundTrip = pixelCrop(source, larger, .75, restored);
  for (const key of ['originX', 'originY', 'width', 'height']) assert.ok(Math.abs(crop[key] - roundTrip[key]) <= 1);
});

test('output resizes without upscaling and rejects insufficient detail', () => {
  assert.deepEqual(outputSize({ width: 2250, height: 3000 }), { width: 1200, height: 1600 });
  assert.deepEqual(outputSize({ width: 600, height: 800 }), { width: 600, height: 800 });
  assert.throws(() => outputSize({ width: 200, height: 300 }), /too small/);
  assert.throws(() => outputSize({ width: 4000, height: 400 }), /too small/);
});

test('original aspect ratio preserves the whole photo at default zoom', () => {
  const source = { width: 1200, height: 2000 };
  assert.deepEqual(pixelCrop(source, canvas, source.width / source.height, {}),
    { originX: 0, originY: 0, width: 1200, height: 2000 });
  assert.equal(imageLayout(source, canvas, .75, { zoom: 100 }).zoom, 6);
});
