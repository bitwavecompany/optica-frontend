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

export interface FaceDetectionResult {
  landmarks: FaceLandmark[];
  imageWidth: number;
  imageHeight: number;
}

export interface GlassesTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface UploadedPhoto {
  file: File;
  url: string;
  width: number;
  height: number;
}