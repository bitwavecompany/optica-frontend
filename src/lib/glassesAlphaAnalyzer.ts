export interface LensZone {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  boundingBox: { x: number; y: number; w: number; h: number };
}

export interface GlassesAlphaData {
  leftLens: LensZone;
  rightLens: LensZone;
  imageWidth: number;
  imageHeight: number;
}

const cache = new Map<string, GlassesAlphaData>();
let analysisCanvas: HTMLCanvasElement | null = null;
let analysisCtx: CanvasRenderingContext2D | null = null;

function getAnalysisContext(w: number, h: number): CanvasRenderingContext2D | null {
  if (!analysisCanvas) {
    analysisCanvas = document.createElement("canvas");
  }
  analysisCanvas.width = w;
  analysisCanvas.height = h;

  if (!analysisCtx) {
    analysisCtx = analysisCanvas.getContext("2d", { willReadFrequently: true });
  }

  return analysisCtx;
}

function extractAlphaChannel(img: HTMLImageElement): { alpha: Uint8ClampedArray; w: number; h: number } | null {
  const ctx = getAnalysisContext(img.naturalWidth, img.naturalHeight);
  if (!ctx) return null;

  ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
  const alpha = new Uint8ClampedArray(imageData.data.length / 4);

  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = imageData.data[i * 4 + 3];
  }

  return { alpha, w: img.naturalWidth, h: img.naturalHeight };
}

function buildAlphaMask(alpha: Uint8ClampedArray, w: number, h: number, threshold = 30): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) {
    mask[i] = alpha[i] > threshold ? 1 : 0;
  }
  return mask;
}

function findTransparentCenters(
  mask: Uint8Array,
  w: number,
  h: number,
  frameOnly: Uint8Array
): Array<{ cx: number; cy: number; pixelCount: number; bbox: { x: number; y: number; w: number; h: number } }> {
  const visited = new Uint8Array(w * h);
  const regions: Array<{ cx: number; cy: number; pixelCount: number; bbox: { x: number; y: number; w: number; h: number } }> = [];

  for (let startY = 0; startY < h; startY++) {
    for (let startX = 0; startX < w; startX++) {
      const idx = startY * w + startX;
      if (visited[idx] || mask[idx] !== 0 || frameOnly[idx]) continue;

      const queue: number[] = [idx];
      visited[idx] = 1;

      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let minX = startX, maxX = startX, minY = startY, maxY = startY;
      
      // NUEVA LÓGICA: Bandera para detectar si la región transparente toca el borde
      let isBackground = false;

      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        const cx = cur % w;
        const cy = Math.floor(cur / w);

        // Si el píxel toca los bordes de la imagen, marcamos toda la región como "fondo"
        if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) {
          isBackground = true;
        }

        sumX += cx;
        sumY += cy;
        count++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          cur - 1, cur + 1,
          cur - w, cur + w,
        ];

        for (const n of neighbors) {
          if (n < 0 || n >= w * h) continue;
          if (visited[n]) continue;
          
          const nx = n % w;
          // Evitamos el "wrap-around" en los bordes izquierdo/derecho del array 1D
          if (Math.abs(nx - cx) > 1) continue;
          
          if (mask[n] !== 0) continue;
          
          visited[n] = 1;
          queue.push(n);
        }
      }

      // IMPORTANTE: Solo agregamos la región si tiene buen tamaño Y NO es el fondo
      if (count > 100 && !isBackground) {
        regions.push({
          cx: sumX / count,
          cy: sumY / count,
          pixelCount: count,
          bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        });
      }
    }
  }

  return regions;
}

function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const result = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) continue;
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          if (mask[ny * w + nx]) found = true;
        }
      }
      if (found) result[y * w + x] = 1;
    }
  }
  return result;
}

function computeLensZone(
  region: { cx: number; cy: number; pixelCount: number; bbox: { x: number; y: number; w: number; h: number } },
  imgW: number,
  imgH: number
): LensZone {
  const paddingRatio = 0.08;
  const pw = region.bbox.w * paddingRatio;
  const ph = region.bbox.h * paddingRatio;

  const bx = Math.max(0, region.bbox.x - pw);
  const by = Math.max(0, region.bbox.y - ph);
  const bw = Math.min(imgW - bx, region.bbox.w + pw * 2);
  const bh = Math.min(imgH - by, region.bbox.h + ph * 2);

  return {
    centerX: region.cx / imgW,
    centerY: region.cy / imgH,
    radiusX: (region.bbox.w / 2) / imgW,
    radiusY: (region.bbox.h / 2) / imgH,
    boundingBox: {
      x: bx / imgW,
      y: by / imgH,
      w: bw / imgW,
      h: bh / imgH,
    },
  };
}

function fallbackSymmetricZones(): GlassesAlphaData["leftLens"] {
  return {
    centerX: 0.27,
    centerY: 0.5,
    radiusX: 0.18,
    radiusY: 0.32,
    boundingBox: { x: 0.07, y: 0.12, w: 0.38, h: 0.76 },
  };
}

export function analyzeGlassesAlpha(img: HTMLImageElement, src: string): GlassesAlphaData {
  if (cache.has(src)) return cache.get(src)!;

  const raw = extractAlphaChannel(img);

  if (!raw) {
    const fallback: GlassesAlphaData = {
      leftLens:  fallbackSymmetricZones(),
      rightLens: { ...fallbackSymmetricZones(), centerX: 0.73, boundingBox: { x: 0.55, y: 0.12, w: 0.38, h: 0.76 } },
      imageWidth:  img.naturalWidth,
      imageHeight: img.naturalHeight,
    };
    cache.set(src, fallback);
    return fallback;
  }

  const { alpha, w, h } = raw;
  const frameMask = buildAlphaMask(alpha, w, h, 30);
  const dilated   = dilate(frameMask, w, h, 3);
  const regions   = findTransparentCenters(frameMask, w, h, dilated);

  const significant = regions
    .filter((r) => r.bbox.w > w * 0.05 && r.bbox.h > h * 0.15)
    .sort((a, b) => b.pixelCount - a.pixelCount)
    .slice(0, 2)
    .sort((a, b) => a.cx - b.cx);

  let leftLens: LensZone;
  let rightLens: LensZone;

  if (significant.length === 2) {
    leftLens  = computeLensZone(significant[0], w, h);
    rightLens = computeLensZone(significant[1], w, h);
  } else if (significant.length === 1) {
    const zone = computeLensZone(significant[0], w, h);
    const mirrorCX = 1 - zone.centerX;

    if (zone.centerX < 0.5) {
      leftLens  = zone;
      rightLens = { ...zone, centerX: mirrorCX, boundingBox: { ...zone.boundingBox, x: 1 - zone.boundingBox.x - zone.boundingBox.w } };
    } else {
      rightLens = zone;
      leftLens  = { ...zone, centerX: mirrorCX, boundingBox: { ...zone.boundingBox, x: 1 - zone.boundingBox.x - zone.boundingBox.w } };
    }
  } else {
    leftLens  = fallbackSymmetricZones();
    rightLens = { ...fallbackSymmetricZones(), centerX: 0.73, boundingBox: { x: 0.55, y: 0.12, w: 0.38, h: 0.76 } };
  }

  const result: GlassesAlphaData = { leftLens, rightLens, imageWidth: w, imageHeight: h };
  cache.set(src, result);
  return result;
}

export function getAbsoluteLensZone(
  zone: LensZone,
  transform: { x: number; y: number; width: number; height: number }
): { centerX: number; centerY: number; radiusX: number; radiusY: number } {
  return {
    centerX: transform.x + zone.centerX * transform.width,
    centerY: transform.y + zone.centerY * transform.height,
    radiusX: zone.radiusX * transform.width,
    radiusY: zone.radiusY * transform.height,
  };
}

export function clearAlphaCache(src?: string): void {
  if (src) {
    cache.delete(src);
  } else {
    cache.clear();
  }
}