import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FaceLandmark } from "@/types";

export type TrackingStatus = "initializing" | "no-face" | "tracking" | "error";

export interface FaceTrackingResult {
  matrix4x4: Float32Array;
  landmarks: FaceLandmark[];
}

interface UseVideoFaceTrackingReturn {
  startTracking: (videoElement: HTMLVideoElement) => void;
  stopTracking: () => void;
  status: TrackingStatus;
  result: FaceTrackingResult | null;
  errorMessage: string | null;
}

export function useVideoFaceTracking(): UseVideoFaceTrackingReturn {
  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [result, setResult] = useState<FaceTrackingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopTracking = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastVideoTimeRef.current = -1;
    videoRef.current = null;
    setResult(null);
    setStatus((prev) => (prev === "error" ? "error" : "no-face"));
  }, []);

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
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setStatus("no-face");
        }
      } catch (err) {
        console.error("useVideoFaceTracking: error inicializando MediaPipe", err);
        if (isMounted) {
          setStatus("error");
          setErrorMessage("No se pudo cargar el motor de detección facial.");
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
      stopTracking();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [stopTracking]);

  const startTracking = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!landmarkerRef.current || status === "error") return;

      videoRef.current = videoElement;

      const detectFrame = () => {
        const video = videoRef.current;
        if (!video || !landmarkerRef.current) return;

        if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
          lastVideoTimeRef.current = video.currentTime;

          const detection = landmarkerRef.current.detectForVideo(
            video,
            performance.now()
          );

          if (
            detection.faceLandmarks &&
            detection.faceLandmarks.length > 0 &&
            detection.facialTransformationMatrixes &&
            detection.facialTransformationMatrixes.length > 0
          ) {
            setResult({
              matrix4x4: new Float32Array(detection.facialTransformationMatrixes[0].data),
              landmarks: detection.faceLandmarks[0] as unknown as FaceLandmark[],
            });
            setStatus("tracking");
          } else {
            setResult(null);
            setStatus("no-face");
          }
        }

        rafRef.current = requestAnimationFrame(detectFrame);
      };

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(detectFrame);
    },
    [status]
  );

  return { startTracking, stopTracking, status, result, errorMessage };
}