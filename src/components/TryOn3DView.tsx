import { useCallback, useEffect, useRef, useState } from "react";
import type { Glasses } from "@/types";
import { useVideoFaceTracking } from "@/hooks/useVideoFaceTracking";
import { GlassesCanvas3D } from "@/components/GlassesCanvas3D";
import clsx from "clsx";

interface TryOn3DViewProps {
  selectedGlasses: Glasses | null;
}

type VideoSize = { w: number; h: number };

export function TryOn3DView({ selectedGlasses }: TryOn3DViewProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError,  setCameraError]  = useState<string | null>(null);
  const [videoSize,    setVideoSize]    = useState<VideoSize>({ w: 0, h: 0 });
  const [containerH,   setContainerH]  = useState<number>(480);

  const { startTracking, stopTracking, status, result, errorMessage } =
    useVideoFaceTracking();

  const recalcHeight = useCallback(() => {
    if (!containerRef.current || videoSize.w === 0) return;
    const availW = containerRef.current.offsetWidth;
    const ratio  = videoSize.h / videoSize.w;
    setContainerH(Math.round(availW * ratio));
  }, [videoSize]);

  useEffect(() => {
    recalcHeight();
    window.addEventListener("resize", recalcHeight);
    return () => window.removeEventListener("resize", recalcHeight);
  }, [recalcHeight, cameraActive]);

  const stopCamera = useCallback(() => {
    stopTracking();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setVideoSize({ w: 0, h: 0 });
  }, [stopTracking]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      const settings   = videoTrack.getSettings();
      if (settings.width && settings.height) {
        setVideoSize({ w: settings.width, h: settings.height });
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => console.error("Error al reproducir video:", err));
    }
  }, [cameraActive]);

  function handleVideoMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w > 0 && h > 0) {
      setVideoSize({ w, h });
    }
  }

  function handleVideoReady() {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth > 0 && videoSize.w === 0) {
      setVideoSize({ w: video.videoWidth, h: video.videoHeight });
    }
    startTracking(video);
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {!cameraActive ? (
        <div className="flex flex-col items-center justify-center w-full h-72 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800/50 gap-4">
          {status === "initializing" ? (
            <>
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Cargando motor de IA 3D...</p>
            </>
          ) : cameraError ? (
            <p className="text-red-400 text-sm text-center px-6">{cameraError}</p>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-slate-200 font-medium">Modo 3D en tiempo real</p>
                <p className="text-slate-400 text-sm mt-1">Activa la cámara para comenzar</p>
              </div>
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Activar cámara
              </button>
            </>
          )}
        </div>

      ) : (
        <div
          ref={containerRef}
          className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-slate-700"
          style={{ height: containerH > 0 ? containerH : 480 }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleVideoMetadata}
            onLoadedData={handleVideoReady}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: "block",
              minHeight: "1px",
            }}
          />

          {videoSize.w > 0 && videoSize.h > 0 && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <GlassesCanvas3D
                trackingResult={result}
                selectedGlasses={selectedGlasses}
                width={videoSize.w}
                height={videoSize.h}
              />
            </div>
          )}

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border",
                status === "tracking"
                  ? "bg-green-500/80 border-green-400 text-white"
                  : "bg-slate-900/80 border-slate-700 text-slate-300"
              )}
            >
              {status === "initializing" && "Iniciando IA..."}
              {status === "no-face"      && "Sin rostro detectado"}
              {status === "tracking"     && "Rastreando rostro"}
              {status === "error"        && (errorMessage ?? "Error")}
            </span>

            <button
              onClick={stopCamera}
              className="pointer-events-auto px-3 py-1 rounded-full text-xs font-medium bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Detener
            </button>
          </div>

          {!selectedGlasses && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
              <span className="px-4 py-2 rounded-full text-xs font-medium bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300">
                Selecciona un lente del catálogo para probártelo
              </span>
            </div>
          )}
        </div>
      )}

      {selectedGlasses && !selectedGlasses.modelPath && cameraActive && (
        <div className="w-full px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm text-center">
            Este lente no tiene modelo 3D aún, solo disponible en modo Foto
          </p>
        </div>
      )}
    </div>
  );
}