import type { FaceLandmark, GlassesTransform } from "@/types";

const LANDMARK = {
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  NOSE_BRIDGE: 6,
  LEFT_TEMPLE: 234,
  RIGHT_TEMPLE: 454,
};

function toPixel(
  landmark: FaceLandmark,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: landmark.x * imageWidth,
    y: landmark.y * imageHeight,
  };
}

function calcularDistancia(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

function calcularAngulo(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export function calcularPosicionLentes(
  landmarks: FaceLandmark[],
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number
): GlassesTransform {
  const leftOuter  = toPixel(landmarks[LANDMARK.LEFT_EYE_OUTER],  imageWidth, imageHeight);
  const rightOuter = toPixel(landmarks[LANDMARK.RIGHT_EYE_OUTER], imageWidth, imageHeight);
  const leftTemple = toPixel(landmarks[LANDMARK.LEFT_TEMPLE],      imageWidth, imageHeight);
  const rightTemple= toPixel(landmarks[LANDMARK.RIGHT_TEMPLE],     imageWidth, imageHeight);
  const noseBridge = toPixel(landmarks[LANDMARK.NOSE_BRIDGE],      imageWidth, imageHeight);

  const faceWidth      = calcularDistancia(leftTemple, rightTemple);
  const glassesWidth   = faceWidth * 1.08;
  const glassesHeight  = glassesWidth / aspectRatio;
  const eyeLineAngle   = calcularAngulo(leftOuter, rightOuter);

  const centerX = (leftOuter.x + rightOuter.x) / 2;
  const centerY = noseBridge.y;

  return {
    x: centerX - glassesWidth / 2,
    y: centerY - glassesHeight / 2,
    width: glassesWidth,
    height: glassesHeight,
    rotation: eyeLineAngle,
  };
}