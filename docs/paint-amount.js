// Interior paint samples from the strokes of В, Е, Д and Р in sign.png (700 × 369).
const swatches = [
  [97, 61, 14, 100], [210, 60, 64, 11], [210, 154, 66, 11],
  [207, 61, 14, 105], [428, 62, 13, 103], [370, 64, 15, 99],
];
const patchWeights = [.03, .21, .5, .79, .97, .97, .79, .5, .21, .03];

function makePaintLayer(photo, width, top, height) {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = photo.naturalHeight;
  const context = layer.getContext('2d');
  context.drawImage(photo, 0, 0);
  const photograph = context.getImageData(0, 0, width, layer.height).data;
  layer.height = height;
  const ink = context.createImageData(width, height);
  const mixed = new Float32Array(ink.data.length);

  // Overlap different photographed fragments. Feathered joins avoid a visible tile grid.
  let seed = 16273;
  const pick = (size) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 0x100000000) * size);
  };
  const patchSize = patchWeights.length;
  const stride = patchSize / 2;
  for (let y = -stride; y < height; y += stride) {
    for (let x = -stride; x < width; x += stride) {
      const [left, upper, w, h] = swatches[pick(swatches.length)];
      const sx = left + pick(w - patchSize + 1);
      const sy = upper + pick(h - patchSize + 1);
      for (let dy = Math.max(0, -y); dy < Math.min(patchSize, height - y); dy++) {
        for (let dx = Math.max(0, -x); dx < Math.min(patchSize, width - x); dx++) {
          const weight = patchWeights[dx] * patchWeights[dy];
          const source = ((sy + dy) * width + sx + dx) * 4;
          const target = ((y + dy) * width + x + dx) * 4;
          mixed[target] += photograph[source] * weight;
          mixed[target + 1] += photograph[source + 1] * weight;
          mixed[target + 2] += photograph[source + 2] * weight;
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;
      const source = ((top + y) * width + x) * 4 + 1;
      // Carry small changes in the local enamel surface through the paint.
      const surface = photograph[source] -
        (photograph[source - 3 * width * 4] + photograph[source + 3 * width * 4]) / 2;
      ink.data[target] = mixed[target] + surface * .55;
      ink.data[target + 1] = mixed[target + 1] + surface * .55;
      ink.data[target + 2] = mixed[target + 2] + surface * .55;
      ink.data[target + 3] = 255;
    }
  }
  context.putImageData(ink, 0, 0);
  return layer;
}

export function createBudgetPainter(photo, canvas) {
  const width = photo.naturalWidth;
  const height = photo.naturalHeight;
  canvas.width = width;
  canvas.height = height;
  const rowTop = Math.round(height * .51);
  const rowHeight = Math.round(height * .31);
  const paint = makePaintLayer(photo, width, rowTop, rowHeight);
  const context = canvas.getContext('2d');

  return (number, showCurrency) => {
    context.clearRect(0, 0, width, height);
    const digitCount = number.replace(/\D/g, '').length;
    const size = width * .17 * Math.min(1, 10 / Math.max(1, digitCount));
    const numberFont = `700 ${size}px Arial`;
    const currencyFont = `700 ${size * .72}px Arial`;
    context.font = numberFont;
    const metrics = context.measureText(number);
    context.font = currencyFont;
    const gap = showCurrency ? size * .18 : 0;
    const textWidth = metrics.width + gap + (showCurrency ? context.measureText('₽').width : 0);
    const scale = Math.min(1, width * .78 / textWidth);
    const baseline = Math.round(height * .676 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);

    context.save();
    context.translate((width - textWidth * scale) / 2, baseline);
    context.scale(scale, 1);
    context.lineWidth = size * .011;
    context.lineJoin = 'round';
    context.font = numberFont;
    context.strokeText(number, 0, 0);
    context.fillText(number, 0, 0);
    if (showCurrency) {
      context.font = currencyFont;
      context.fillText('₽', metrics.width + gap, 0);
    }
    context.restore();

    context.globalCompositeOperation = 'source-in';
    context.drawImage(paint, 0, rowTop);
    context.globalCompositeOperation = 'source-over';
  };
}
