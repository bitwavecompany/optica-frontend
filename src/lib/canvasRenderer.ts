import type { Glasses, FaceDetectionResult, GlassesTransform } from "@/types";
import {
  calcularPosicionLentes,
  getNosePolygon,
  calcularSombraGafas,
} from "@/lib/faceUtils";
import { estimateLighting } from "@/lib/lightingEstimator";
import { drawGlassesHomography } from "@/lib/homographyRenderer";
import { drawGlare } from "@/lib/glareRenderer";
import { analyzeGlassesAlpha } from "@/lib/glassesAlphaAnalyzer";

export interface RenderConfig {
  canvas: HTMLCanvasElement;
  photoImg: HTMLImageElement;
  glassesImg: HTMLImageElement | null;
  glassesImageSrc: string;
  faceResult: FaceDetectionResult | null;
  displayW: number;
  displayH: number;
  selectedGlasses: Glasses | null;
}

// --- SISTEMA DE CACHÉ PARA OFFSCREEN CANVASES ---
// Previene fugas de memoria y caídas de FPS al no crear elementos DOM en cada render.
const canvasPool: Record<string, HTMLCanvasElement> = {};

function getOffscreenCanvas(id: string, w: number, h: number): HTMLCanvasElement {
  if (!canvasPool[id]) {
    canvasPool[id] = document.createElement("canvas");
  }
  const canvas = canvasPool[id];
  
  // Solo redimensiona si es necesario (el redimensionar también limpia el canvas automáticamente)
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    // Aseguramos que el canvas esté limpio y sin filtros para el nuevo frame
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
  }
  
  return canvas;
}
// ------------------------------------------------

export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawNoseOcclusionFeathered(
  ctx: CanvasRenderingContext2D,
  photoImg: HTMLImageElement,
  nosePoints: Array<{ x: number; y: number }>,
  displayW: number,
  displayH: number
): void {
  if (nosePoints.length === 0) return;

  const offscreen = getOffscreenCanvas("occOffscreen", displayW, displayH);
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;

  offCtx.drawImage(photoImg, 0, 0, displayW, displayH);

  const maskCanvas = getOffscreenCanvas("occMask", displayW, displayH);
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;

  maskCtx.filter = "blur(3px)";
  maskCtx.beginPath();
  maskCtx.moveTo(nosePoints[0].x, nosePoints[0].y);
  for (let i = 1; i < nosePoints.length; i++) {
    maskCtx.lineTo(nosePoints[i].x, nosePoints[i].y);
  }
  maskCtx.closePath();
  maskCtx.fillStyle = "white";
  maskCtx.fill();
  maskCtx.filter = "none"; // Reset filter

  offCtx.globalCompositeOperation = "destination-in";
  offCtx.drawImage(maskCanvas, 0, 0);
  offCtx.globalCompositeOperation = "source-over"; // Reset composite

  ctx.drawImage(offscreen, 0, 0);
}

export function renderScene(config: RenderConfig): void {
  const {
    canvas,
    photoImg,
    glassesImg,
    glassesImageSrc,
    faceResult,
    displayW,
    displayH,
    selectedGlasses,
  } = config;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, displayW, displayH);
  ctx.drawImage(photoImg, 0, 0, displayW, displayH);

  if (!faceResult || !selectedGlasses || !glassesImg) return;

  const headPose = faceResult.headPose ?? { yaw: 0, pitch: 0, roll: 0 };

  const lighting = estimateLighting(ctx, faceResult.landmarks, displayW, displayH);

  const transform: GlassesTransform = calcularPosicionLentes(
    faceResult.landmarks,
    displayW,
    displayH,
    glassesImg.naturalWidth / glassesImg.naturalHeight,
    faceResult.pupilCenters,
    faceResult.faceDepthZ
  );

  const nosePoints = getNosePolygon(faceResult.landmarks, displayW, displayH);

  const shadow = calcularSombraGafas(transform, headPose, lighting);

  const shadowOffscreen = getOffscreenCanvas("shadow", displayW, displayH);
  const shadowCtx = shadowOffscreen.getContext("2d", { willReadFrequently: true })!;

  shadowCtx.filter    = `blur(${shadow.blur}px)`;
  shadowCtx.fillStyle = "rgba(0,0,0,0.85)";
  shadowCtx.beginPath();
  shadowCtx.ellipse(shadow.x, shadow.y, shadow.rx, shadow.ry, 0, 0, Math.PI * 2);
  shadowCtx.fill();
  shadowCtx.filter = "none"; // Reset filter

  if (nosePoints.length > 0) {
    const noseMask = getOffscreenCanvas("noseMask", displayW, displayH);
    const noseMaskCtx = noseMask.getContext("2d", { willReadFrequently: true })!;

    noseMaskCtx.fillStyle = "white";
    noseMaskCtx.fillRect(0, 0, displayW, displayH);

    noseMaskCtx.globalCompositeOperation = "destination-out";
    noseMaskCtx.filter = "blur(2px)";
    noseMaskCtx.beginPath();
    noseMaskCtx.moveTo(nosePoints[0].x, nosePoints[0].y);
    for (let i = 1; i < nosePoints.length; i++) {
      noseMaskCtx.lineTo(nosePoints[i].x, nosePoints[i].y);
    }
    noseMaskCtx.closePath();
    noseMaskCtx.fill();
    noseMaskCtx.filter = "none"; // Reset filter
    noseMaskCtx.globalCompositeOperation = "source-over"; // Reset composite

    shadowCtx.globalCompositeOperation = "destination-in";
    shadowCtx.drawImage(noseMask, 0, 0);
    shadowCtx.globalCompositeOperation = "source-over"; // Reset composite
  }

  ctx.save();
  ctx.globalAlpha = shadow.opacity;
  ctx.drawImage(shadowOffscreen, 0, 0);
  ctx.restore();

  drawGlassesHomography({
    ctx,
    glassesImg,
    imageSrc:   glassesImageSrc,
    transform,
    headPose,
    displayW,
    displayH,
    warmth:     lighting.warmth,
    brightness: lighting.brightness,
  });

  const alphaData = analyzeGlassesAlpha(glassesImg, glassesImageSrc);

  drawGlare(ctx, transform, headPose, lighting, alphaData);

  drawNoseOcclusionFeathered(ctx, photoImg, nosePoints, displayW, displayH);
}