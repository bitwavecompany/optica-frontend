import { useCallback, useState, useRef, useEffect } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FaceDetectionResult } from "@/types";
import {
  extractHeadPose,
  extractPupilCenters,
  extractFaceDepthZ,
} from "@/lib/faceUtils";
import { disposeHomographyRenderer } from "@/lib/homographyRenderer";

type DetectionStatus = "idle" | "initializing" | "processing" | "success" | "error";

interface UseFaceDetectionReturn {
  detect: (imageElement: HTMLImageElement) => Promise<FaceDetectionResult | null>;
  status: DetectionStatus;
  errorMessage: string | null;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [status, setStatus]           = useState<DetectionStatus>("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes:             false,
          outputFacialTransformationMatrixes: true,
          runningMode: "IMAGE",
          numFaces:    1,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setStatus("idle");
        }
      } catch (err) {
        console.error("Error inicializando MediaPipe:", err);
        if (isMounted) {
          setStatus("error");
          setErrorMessage("No se pudo cargar el motor de detección facial.");
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      disposeHomographyRenderer();
    };
  }, []);

  const detect = useCallback(
    async (imageElement: HTMLImageElement): Promise<FaceDetectionResult | null> => {
      if (!landmarkerRef.current) {
        setErrorMessage("El sistema de detección aún no está listo.");
        return null;
      }

      setStatus("processing");
      setErrorMessage(null);

      try {
        const result = landmarkerRef.current.detect(imageElement);

        if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
          setStatus("error");
          setErrorMessage(
            "No se detectó ningún rostro en la foto. Intenta con otra imagen."
          );
          return null;
        }

        const landmarks   = result.faceLandmarks[0];
        const matrixData  = result.facialTransformationMatrixes?.[0]?.data ?? null;
        const headPose    = matrixData ? extractHeadPose(matrixData) : null;
        const pupilCenters = extractPupilCenters(landmarks);
        const faceDepthZ   = extractFaceDepthZ(landmarks);

        setStatus("success");

        return {
          landmarks,
          imageWidth:  imageElement.naturalWidth,
          imageHeight: imageElement.naturalHeight,
          headPose,
          pupilCenters,
          faceDepthZ,
        };
      } catch (err) {
        console.error("Error detectando rostro:", err);
        setStatus("error");
        setErrorMessage("Error al analizar la imagen. Intenta nuevamente.");
        return null;
      }
    },
    []
  );

  return { detect, status, errorMessage };
}