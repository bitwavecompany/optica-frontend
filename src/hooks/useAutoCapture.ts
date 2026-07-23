import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { extractHeadPose } from "@/lib/faceUtils";

export type GuideStatus = 
  | "initializing" 
  | "no-face" 
  | "too-far" 
  | "too-close" 
  | "bad-angle" 
  | "tilted" 
  | "perfect" 
  | "error";

interface UseAutoCaptureReturn {
  startTracking: (videoElement: HTMLVideoElement, onCaptureCallback: () => void) => void;
  stopTracking: () => void;
  status: GuideStatus;
  progress: number;
  errorMessage: string | null;
}

const RULES = {
  MAX_YAW_PITCH: 12,
  MAX_ROLL: 10,
  MIN_FACE_PCT: 0.45,
  MAX_FACE_PCT: 0.75,
  HOLD_TIME_MS: 3000
};

export function useAutoCapture(): UseAutoCaptureReturn {
  const [status, setStatus] = useState<GuideStatus>("initializing");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const perfectStartTimeRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    perfectStartTimeRef.current = null;
    setProgress(0);
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
        console.error(err);
        if (isMounted) {
          setStatus("error");
          setErrorMessage("No se pudo cargar el motor de detección facial en vivo.");
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
      stopTracking();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, [stopTracking]);

  const startTracking = useCallback(
    (videoElement: HTMLVideoElement, onCaptureCallback: () => void) => {
      if (!landmarkerRef.current || status === "error") return;

      const detectFrame = (currentTime: number) => {
        if (videoElement.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = videoElement.currentTime;

          const result = landmarkerRef.current!.detectForVideo(videoElement, performance.now());

          if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
            setStatus("no-face");
            perfectStartTimeRef.current = null;
            setProgress(0);
          } else {
            const landmarks = result.faceLandmarks[0];
            const matrixData = result.facialTransformationMatrixes?.[0]?.data;

            if (matrixData) {
              const headPose = extractHeadPose(matrixData);
              
              const leftTemple = landmarks[234];
              const rightTemple = landmarks[454];
              const dx = rightTemple.x - leftTemple.x;
              const dy = rightTemple.y - leftTemple.y;
              const faceWidthPct = Math.sqrt(dx * dx + dy * dy);

              let currentStatus: GuideStatus = "perfect";

              if (faceWidthPct < RULES.MIN_FACE_PCT) {
                currentStatus = "too-far";
              } else if (faceWidthPct > RULES.MAX_FACE_PCT) {
                currentStatus = "too-close";
              } 
              else if (
                Math.abs(headPose.yaw) > RULES.MAX_YAW_PITCH || 
                Math.abs(headPose.pitch) > RULES.MAX_YAW_PITCH
              ) {
                currentStatus = "bad-angle";
              } 
              else if (Math.abs(headPose.roll) > RULES.MAX_ROLL) {
                currentStatus = "tilted";
              }

              setStatus(currentStatus);

              if (currentStatus === "perfect") {
                if (perfectStartTimeRef.current === null) {
                  perfectStartTimeRef.current = currentTime;
                } else {
                  const elapsed = currentTime - perfectStartTimeRef.current;
                  const currentProgress = Math.min((elapsed / RULES.HOLD_TIME_MS) * 100, 100);
                  setProgress(currentProgress);

                  if (elapsed >= RULES.HOLD_TIME_MS) {
                    stopTracking();
                    onCaptureCallback();
                    return;
                  }
                }
              } else {
                perfectStartTimeRef.current = null;
                setProgress(0);
              }
            }
          }
        }

        requestRef.current = requestAnimationFrame(detectFrame);
      };

      requestRef.current = requestAnimationFrame(detectFrame);
    },
    [status, stopTracking]
  );

  return { startTracking, stopTracking, status, progress, errorMessage };
}