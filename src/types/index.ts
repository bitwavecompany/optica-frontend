export interface Glasses {
  id: string;
  name: string;
  brand: string;
  category: GlassesCategory;
  imagePath: string;
  aspectRatio: number;
}

export type GlassesCategory = "sol" | "graduados" | "deportivos";

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export type NosePoint = { x: number; y: number };

export interface PupilCenters {
  left:  { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
}

export interface FaceDetectionResult {
  landmarks:    FaceLandmark[];
  imageWidth:   number;
  imageHeight:  number;
  headPose:     HeadPose | null;
  pupilCenters: PupilCenters | null;
  faceDepthZ:   number;
}

export interface GlassesTransform {
  x:        number;
  y:        number;
  width:    number;
  height:   number;
  rotation: number;
  depthScale: number;
  quadPoints: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
}

export interface ShadowConfig {
  x:       number;
  y:       number;
  rx:      number;
  ry:      number;
  opacity: number;
  blur:    number;
}

export interface UploadedPhoto {
  file:   File;
  url:    string;
  width:  number;
  height: number;
}

export interface LightingEstimate {
  brightness:  number;
  warmth:      number;
  contrast:    number;
  direction:   "left" | "right" | "top" | "frontal";
  shadowSide:  "left" | "right" | "none";
}

// NUEVO: Tipos estrictos para el sistema de Auto-Capture Inteligente (Cámara IA)
export type GuideStatus = 
  | "initializing" 
  | "no-face" 
  | "too-far" 
  | "too-close" 
  | "bad-angle" 
  | "tilted" 
  | "perfect" 
  | "error";