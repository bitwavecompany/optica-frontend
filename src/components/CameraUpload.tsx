import { useRef, useState, useEffect, useCallback } from "react";
import type { UploadedPhoto } from "@/types";
import { useAutoCapture, type GuideStatus } from "@/hooks/useAutoCapture";
import clsx from "clsx";

interface CameraUploadProps {
  onPhotoReady: (photo: UploadedPhoto) => void;
  disabled?: boolean;
}

// 1. Añadimos el modo "auto"
type Mode = "upload" | "camera" | "auto";

// 2. Diccionario de mensajes de guía visual
const GUIDE_MESSAGES: Record<GuideStatus, string> = {
  "initializing": "Iniciando Inteligencia Artificial...",
  "no-face": "Centra tu rostro en la pantalla",
  "too-far": "Acércate un poco más",
  "too-close": "Aléjate un poco",
  "bad-angle": "Míranos fijamente (frente)",
  "tilted": "Mantén la cabeza recta",
  "perfect": "¡Perfecto! Mantente así...",
  "error": "Error en el sistema de IA",
};

export function CameraUpload({ onPhotoReady, disabled = false }: CameraUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<Mode>("upload");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 3. Integramos el hook
  const { startTracking, stopTracking, status: autoStatus, progress, errorMessage: autoError } = useAutoCapture();

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    stopTracking(); // Detenemos la IA cuando se apaga la cámara
  }, [stopTracking]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime || "image/jpeg" });
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const file = dataURLtoFile(dataUrl, "webcam-capture.jpg");
    const url = URL.createObjectURL(file);

    stopCamera();

    onPhotoReady({
      file,
      url,
      width: video.videoWidth,
      height: video.videoHeight,
    });
  }, [onPhotoReady, stopCamera]);

  // 4. Efecto para encender el Auto-Tracking cuando la cámara esté lista
  useEffect(() => {
    const video = videoRef.current;
    if (mode === "auto" && cameraActive && video) {
      const handleLoadedData = () => {
        startTracking(video, capturePhoto);
      };

      if (video.readyState >= 2) {
        handleLoadedData();
      } else {
        video.addEventListener("loadeddata", handleLoadedData);
        return () => {
          video.removeEventListener("loadeddata", handleLoadedData);
          stopTracking();
        };
      }
    } else {
      stopTracking();
    }
  }, [mode, cameraActive, startTracking, stopTracking, capturePhoto]);

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      onPhotoReady({
        file,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.src = url;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (mode !== "upload") return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (mode === "upload") setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifica los permisos.");
      setCameraActive(false);
    }
  }

  function handleModeSwitch(newMode: Mode) {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === "camera" || newMode === "auto") {
      if (!cameraActive) {
        startCamera();
      }
    } else {
      stopCamera();
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 5. Selector con 3 botones en lugar de 2 */}
      <div className="flex bg-slate-800/50 p-1 rounded-xl w-full max-w-lg mx-auto">
        <button
          onClick={() => handleModeSwitch("upload")}
          className={clsx(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
            mode === "upload"
              ? "bg-brand-500 text-white shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
        >
          Subir Foto
        </button>
        <button
          onClick={() => handleModeSwitch("camera")}
          className={clsx(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
            mode === "camera"
              ? "bg-brand-500 text-white shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
        >
          Cámara Manual
        </button>
        <button
          onClick={() => handleModeSwitch("auto")}
          className={clsx(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-all flex justify-center items-center gap-1",
            mode === "auto"
              ? "bg-brand-500 text-white shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
        >
          Cámara Auto <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md ml-1">BETA</span>
        </button>
      </div>

      {mode === "upload" ? (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={clsx(
            "relative flex flex-col items-center justify-center gap-4",
            "w-full h-64 rounded-2xl border-2 border-dashed cursor-pointer",
            "transition-all duration-200 select-none",
            isDragging
              ? "border-brand-500 bg-brand-500/10 scale-[1.02]"
              : "border-slate-600 bg-slate-800/50 hover:border-brand-500 hover:bg-slate-800",
            disabled ? "opacity-50 cursor-not-allowed" : ""
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />

          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-200 font-medium">
                {isDragging ? "Suelta la foto aquí" : "Sube tu foto"}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Arrastra una imagen o haz clic para seleccionar
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-72 rounded-2xl overflow-hidden bg-slate-900 relative border border-slate-700">
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-red-400 text-sm">{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              {/* Botón de captura manual (Solo visible en modo "camera") */}
              {cameraActive && mode === "camera" && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <button
                    onClick={capturePhoto}
                    className="bg-brand-500 hover:bg-brand-600 text-white rounded-full p-3 shadow-lg transition-transform active:scale-95 border-2 border-white/20"
                  >
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Interfaz de Guía (Solo visible en modo "auto") */}
              {cameraActive && mode === "auto" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {autoStatus === "initializing" ? (
                    <div className="flex flex-col items-center gap-2 bg-slate-900/80 px-4 py-3 rounded-xl backdrop-blur-sm">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-white text-sm font-medium">Iniciando IA...</span>
                    </div>
                  ) : (
                    <>
                      {/* Anillo de Progreso y Alineación */}
                      <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.15)" strokeWidth="3" fill="none" />
                        
                        {/* Círculo de exito/carga */}
                        {autoStatus === "perfect" && (
                          <circle cx="50" cy="50" r="46" stroke="#22c55e" strokeWidth="5" fill="none" 
                                  strokeDasharray="289" strokeDashoffset={289 - (289 * progress) / 100} 
                                  className="transition-all duration-100 ease-linear shadow-[0_0_10px_#22c55e]" />
                        )}
                        
                        {/* Círculo de advertencia (amarillo) si la pose falla pero hay un rostro */}
                        {autoStatus !== "perfect" && autoStatus !== "no-face" && (
                          <circle cx="50" cy="50" r="46" stroke="#eab308" strokeWidth="4" fill="none" 
                                  strokeDasharray="289" strokeDashoffset="0" className="opacity-50" />
                        )}
                      </svg>

                      {/* Texto de feedback o error */}
                      <div className="absolute bottom-6 flex justify-center w-full">
                        <span className={clsx(
                          "px-5 py-2 rounded-full text-white text-sm font-semibold backdrop-blur-md border shadow-lg transition-colors",
                          autoStatus === "perfect" ? "bg-green-500/80 border-green-400" :
                          autoStatus === "no-face" ? "bg-slate-900/80 border-slate-700" :
                          autoStatus === "error" ? "bg-red-500/80 border-red-400" :
                          "bg-yellow-500/80 border-yellow-400 text-yellow-50"
                        )}>
                          {autoError || GUIDE_MESSAGES[autoStatus] || "Analizando..."}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}