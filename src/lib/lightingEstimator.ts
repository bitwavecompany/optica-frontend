import type { FaceLandmark } from "@/types";

export interface LightingEstimate {
  brightness: number;
  warmth: number;
  contrast: number;
  direction: "left" | "right" | "top" | "frontal";
  shadowSide: "left" | "right" | "none";
}

interface SampleZone {
  landmarks: number[];
  weight: number;
}

const FOREHEAD_LANDMARKS = [10, 67, 69, 104, 108, 151, 297, 299, 333, 337];
const LEFT_CHEEK_LANDMARKS = [116, 123, 147, 187, 207, 213, 192];
const RIGHT_CHEEK_LANDMARKS = [345, 352, 376, 411, 427, 433, 416];
const CHIN_LANDMARKS = [152, 377, 400, 378, 379];

const SAMPLE_ZONES: SampleZone[] = [
  { landmarks: FOREHEAD_LANDMARKS,    weight: 0.4 },
  { landmarks: LEFT_CHEEK_LANDMARKS,  weight: 0.25 },
  { landmarks: RIGHT_CHEEK_LANDMARKS, weight: 0.25 },
  { landmarks: CHIN_LANDMARKS,        weight: 0.1 },
];

interface ZoneSample {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

function samplePixelsAroundLandmark(
  imageData: ImageData,
  cx: number,
  cy: number,
  radius: number
): { r: number; g: number; b: number } | null {
  const { width, height, data } = imageData;
  let r = 0, g = 0, b = 0, count = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return null;
  return { r: r / count, g: g / count, b: b / count };
}

function sampleZone(
  imageData: ImageData,
  landmarks: FaceLandmark[],
  indices: number[],
  displayW: number,
  displayH: number,
  sampleRadius: number
): ZoneSample | null {
  let r = 0, g = 0, b = 0, count = 0;

  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const cx = lm.x * displayW;
    const cy = lm.y * displayH;
    const sample = samplePixelsAroundLandmark(imageData, cx, cy, sampleRadius);
    if (!sample) continue;
    r += sample.r;
    g += sample.g;
    b += sample.b;
    count++;
  }

  if (count === 0) return null;

  const avgR = r / count;
  const avgG = g / count;
  const avgB = b / count;
  const brightness = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;

  return { r: avgR, g: avgG, b: avgB, brightness };
}

function estimateColorTemperature(r: number, b: number): number {
  if (b === 0) return 1;
  return r / b;
}

function estimateLightDirection(
  leftCheek: ZoneSample | null,
  rightCheek: ZoneSample | null,
  forehead: ZoneSample | null
): { direction: LightingEstimate["direction"]; shadowSide: LightingEstimate["shadowSide"] } {
  if (!leftCheek || !rightCheek) {
    return { direction: "frontal", shadowSide: "none" };
  }

  const diff = leftCheek.brightness - rightCheek.brightness;
  const threshold = 0.06;

  if (Math.abs(diff) < threshold) {
    if (forehead && forehead.brightness > (leftCheek.brightness + rightCheek.brightness) / 2 + 0.05) {
      return { direction: "top", shadowSide: "none" };
    }
    return { direction: "frontal", shadowSide: "none" };
  }

  if (diff > 0) {
    return { direction: "left", shadowSide: "right" };
  }

  return { direction: "right", shadowSide: "left" };
}

function computeContrast(zones: (ZoneSample | null)[]): number {
  const valid = zones.filter((z): z is ZoneSample => z !== null);
  if (valid.length < 2) return 0.5;

  const brightnesses = valid.map((z) => z.brightness);
  const max = Math.max(...brightnesses);
  const min = Math.min(...brightnesses);

  return Math.min(1, (max - min) * 2.5);
}

export function estimateLighting(
  ctx: CanvasRenderingContext2D,
  landmarks: FaceLandmark[],
  displayW: number,
  displayH: number
): LightingEstimate {
  const fallback: LightingEstimate = {
    brightness: 0.6,
    warmth: 1.0,
    contrast: 0.5,
    direction: "frontal",
    shadowSide: "none",
  };

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, displayW, displayH);
  } catch {
    return fallback;
  }

  const sampleRadius = Math.max(3, Math.round(displayW * 0.008));

  const zoneSamples = SAMPLE_ZONES.map((zone) =>
    sampleZone(imageData, landmarks, zone.landmarks, displayW, displayH, sampleRadius)
  );

  const [foreheadSample, leftCheekSample, rightCheekSample, chinSample] = zoneSamples;

  const validSamples = zoneSamples.filter((s): s is ZoneSample => s !== null);
  if (validSamples.length === 0) return fallback;

  let weightedBrightness = 0;
  let weightedR = 0;
  let weightedB = 0;
  let totalWeight = 0;

  SAMPLE_ZONES.forEach((zone, i) => {
    const sample = zoneSamples[i];
    if (!sample) return;
    weightedBrightness += sample.brightness * zone.weight;
    weightedR += sample.r * zone.weight;
    weightedB += sample.b * zone.weight;
    totalWeight += zone.weight;
  });

  if (totalWeight === 0) return fallback;

  const brightness = weightedBrightness / totalWeight;
  const avgR = weightedR / totalWeight;
  const avgB = weightedB / totalWeight;
  const warmth = estimateColorTemperature(avgR, avgB);
  const contrast = computeContrast([foreheadSample, leftCheekSample, rightCheekSample, chinSample]);
  const { direction, shadowSide } = estimateLightDirection(leftCheekSample, rightCheekSample, foreheadSample);

  return {
    brightness: Math.max(0.1, Math.min(1, brightness)),
    warmth:     Math.max(0.5, Math.min(2.0, warmth)),
    contrast:   Math.max(0,   Math.min(1, contrast)),
    direction,
    shadowSide,
  };
}