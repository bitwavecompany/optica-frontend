import type {
  FaceLandmark,
  GlassesTransform,
  HeadPose,
  NosePoint,
  PupilCenters,
  ShadowConfig,
} from "@/types";
import type { LightingEstimate } from "@/types";

const LANDMARK = {
  LEFT_EYE_OUTER:   33,
  RIGHT_EYE_OUTER:  263,
  LEFT_EYE_INNER:   133,
  RIGHT_EYE_INNER:  362,
  NOSE_BRIDGE:      6,
  NOSE_TIP:         4,
  LEFT_TEMPLE:      234,
  RIGHT_TEMPLE:     454,
  LEFT_CHEEKBONE:   116,
  RIGHT_CHEEKBONE:  345,
  LEFT_IRIS:        468,
  RIGHT_IRIS:       473,
};

const NOSE_POLYGON_INDICES = [
  168, 122, 196, 3, 51, 45, 44, 43, 106, 182, 83, 18,
  313, 406, 335, 273, 272, 271, 268, 424, 426, 423,
  391, 393, 164, 167, 165, 92, 186, 57,
  129, 49, 131, 134, 51, 5, 281, 363, 360,
  279, 358, 429, 420, 318, 325, 4, 97, 99,
];

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

function calcularAngulo(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function calcularDistancia(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function extractHeadPose(m: Float32Array | number[]): HeadPose {
  const R00 = m[0];
  const R10 = m[1];
  const R20 = m[2];
  const R21 = m[6];
  const R22 = m[10];

  const pitch = Math.atan2(-R20, Math.sqrt(R00 * R00 + R10 * R10));
  const yaw   = Math.atan2(R10, R00);
  const roll  = Math.atan2(R21, R22);

  const toDeg = (r: number) => r * (180 / Math.PI);

  return {
    yaw:   toDeg(yaw),
    pitch: toDeg(pitch),
    roll:  toDeg(roll),
  };
}

export function extractPupilCenters(
  landmarks: FaceLandmark[]
): PupilCenters | null {
  const leftIris  = landmarks[LANDMARK.LEFT_IRIS];
  const rightIris = landmarks[LANDMARK.RIGHT_IRIS];

  if (!leftIris || !rightIris) return null;

  return {
    left:  { x: leftIris.x,  y: leftIris.y,  z: leftIris.z  },
    right: { x: rightIris.x, y: rightIris.y, z: rightIris.z },
  };
}

export function extractFaceDepthZ(landmarks: FaceLandmark[]): number {
  const leftTemple  = landmarks[LANDMARK.LEFT_TEMPLE];
  const rightTemple = landmarks[LANDMARK.RIGHT_TEMPLE];
  const noseBridge  = landmarks[LANDMARK.NOSE_BRIDGE];
  const noseTip     = landmarks[LANDMARK.NOSE_TIP];

  const samples = [leftTemple, rightTemple, noseBridge, noseTip].filter(Boolean);
  if (samples.length === 0) return 0;

  const avgZ = samples.reduce((sum, lm) => sum + lm.z, 0) / samples.length;
  return avgZ;
}

export function extractFaceWidthPct(landmarks: FaceLandmark[]): number {
  const leftTemple  = landmarks[LANDMARK.LEFT_TEMPLE];
  const rightTemple = landmarks[LANDMARK.RIGHT_TEMPLE];
  
  if (!leftTemple || !rightTemple) return 0;

  const dx = rightTemple.x - leftTemple.x;
  const dy = rightTemple.y - leftTemple.y;
  
  return Math.sqrt(dx * dx + dy * dy);
}

export function calcularPosicionLentes(
  landmarks: FaceLandmark[],
  displayW: number,
  displayH: number,
  aspectRatio: number,
  pupilCenters: PupilCenters | null,
  faceDepthZ: number
): GlassesTransform {
  const leftOuter      = toPixel(landmarks[LANDMARK.LEFT_EYE_OUTER],   displayW, displayH);
  const rightOuter     = toPixel(landmarks[LANDMARK.RIGHT_EYE_OUTER],  displayW, displayH);
  const leftTemple     = toPixel(landmarks[LANDMARK.LEFT_TEMPLE],      displayW, displayH);
  const rightTemple    = toPixel(landmarks[LANDMARK.RIGHT_TEMPLE],     displayW, displayH);
  const leftCheekbone  = toPixel(landmarks[LANDMARK.LEFT_CHEEKBONE],   displayW, displayH);
  const rightCheekbone = toPixel(landmarks[LANDMARK.RIGHT_CHEEKBONE],  displayW, displayH);

  const eyeOuterDistance = calcularDistancia(leftOuter, rightOuter);
  const templeWidth      = calcularDistancia(leftTemple, rightTemple);

  const depthScale  = Math.max(0.75, Math.min(1.25, 1 + faceDepthZ * 0.8));

  const baseWidth = (eyeOuterDistance * 1.45 + templeWidth * 0.90) / 2;
  const glassesWidth  = baseWidth * depthScale;
  const glassesHeight = glassesWidth / aspectRatio;

  let centerX: number;
  let eyeMidY: number;

  if (pupilCenters) {
    const leftPupilX  = pupilCenters.left.x  * displayW;
    const leftPupilY  = pupilCenters.left.y  * displayH;
    const rightPupilX = pupilCenters.right.x * displayW;
    const rightPupilY = pupilCenters.right.y * displayH;
    centerX = (leftPupilX + rightPupilX) / 2;
    eyeMidY = (leftPupilY + rightPupilY) / 2;
  } else {
    centerX = (leftOuter.x + rightOuter.x) / 2;
    eyeMidY = (leftOuter.y + rightOuter.y) / 2;
  }

  const centerY = eyeMidY + (glassesHeight * 0.12);

  const rotation = calcularAngulo(leftOuter, rightOuter);

  return {
    x:          centerX - glassesWidth / 2,
    y:          centerY - glassesHeight / 2,
    width:      glassesWidth,
    height:     glassesHeight,
    rotation,
    depthScale,
    quadPoints: [leftTemple, rightTemple, leftCheekbone, rightCheekbone]
  };
}

export function getNosePolygon(
  landmarks: FaceLandmark[],
  displayW: number,
  displayH: number
): NosePoint[] {
  const validIndices = NOSE_POLYGON_INDICES.filter((idx) => !!landmarks[idx]);
  return validIndices.map((idx) => toPixel(landmarks[idx], displayW, displayH));
}

export function calcularSombraGafas(
  transform: GlassesTransform,
  headPose: HeadPose,
  lighting: LightingEstimate
): ShadowConfig {
  const centerX = transform.x + transform.width / 2;

  const yawOffsetX  = (headPose.yaw   / 90) * transform.width * 0.12;
  const pitchFactor = Math.max(0.1, Math.min(1.0, 0.5 + headPose.pitch / 60));
  const shadowY     = transform.y + transform.height * (1.0 + headPose.pitch * 0.004);

  const directionOffsetX =
    lighting.direction === "left"  ?  transform.width * 0.06  :
    lighting.direction === "right" ? -transform.width * 0.06  : 0;

  const contrastOpacity = 0.25 + lighting.contrast * 0.2;
  const opacity         = contrastOpacity * pitchFactor * Math.max(0.3, lighting.brightness);

  const blur = 8 + (1 - lighting.contrast) * 8;

  return {
    x:       centerX + yawOffsetX + directionOffsetX,
    y:       shadowY,
    rx:      transform.width  * 0.44 * transform.depthScale,
    ry:      Math.max(4, 6 + Math.abs(headPose.pitch) * 0.12),
    opacity: Math.min(0.55, opacity),
    blur,
  };
}