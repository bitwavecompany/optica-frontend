import { useEffect, useRef, useState, useCallback } from "react";
import type { UploadedPhoto, Glasses, FaceDetectionResult } from "@/types";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { renderScene, clearCanvas } from "@/lib/canvasRenderer";

interface GlassesCanvasProps {
  photo: UploadedPhoto;
  selectedGlasses: Glasses | null;
}

const MAX_DISPLAY_HEIGHT = 600;

export function GlassesCanvas({ photo, selectedGlasses }: GlassesCanvasProps) {
  const { detect, status, errorMessage } = useFaceDetection();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [photoImage,   setPhotoImage]   = useState<HTMLImageElement | null>(null);
  const [glassesImage, setGlassesImage] = useState<HTMLImageElement | null>(null);
  const [faceResult,   setFaceResult]   = useState<FaceDetectionResult | null>(null);
  const [displaySize,  setDisplaySize]  = useState<{ w: number; h: number; dpr: number } | null>(null);

  const detectedForUrl = useRef<string | null>(null);

  const recalcSize = useCallback(() => {
    if (!containerRef.current || !photoImage) return;
    const dpr = window.devicePixelRatio || 1;
    const containerW = containerRef.current.offsetWidth;
    const maxW = Math.min(containerW, 800);
    const ratio = Math.min(
      maxW / photoImage.naturalWidth,
      MAX_DISPLAY_HEIGHT / photoImage.naturalHeight,
      1
    );
    setDisplaySize({
      w: Math.round(photoImage.naturalWidth  * ratio),
      h: Math.round(photoImage.naturalHeight * ratio),
      dpr,
    });
  }, [photoImage]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recalcSize);
    ro.observe(el);
    recalcSize();
    return () => ro.disconnect();
  }, [recalcSize]);

  useEffect(() => {
    detectedForUrl.current = null;
    const img = new Image();
    img.onload = () => {
      setPhotoImage(img);
      setFaceResult(null);
    };
    img.src = photo.url;
  }, [photo.url]);

  useEffect(() => {
    if (!photoImage || status === "initializing") return;
    if (detectedForUrl.current === photo.url) return;
    detectedForUrl.current = photo.url;
    detect(photoImage).then((result) => setFaceResult(result));
  }, [photoImage, photo.url, status, detect]);

  useEffect(() => {
    if (!selectedGlasses) {
      Promise.resolve().then(() => setGlassesImage(null));
      return;
    }
    const img = new Image();
    img.onload  = () => setGlassesImage(img);
    img.onerror = () =>
      console.error("Error al cargar la imagen de los lentes:", selectedGlasses.imagePath);
    img.src = selectedGlasses.imagePath;
  }, [selectedGlasses]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displaySize || !photoImage) {
      if (canvas) clearCanvas(canvas);
      return;
    }
    void renderScene({
      canvas,
      photoImg: photoImage,
      glassesImg: glassesImage,
      glassesImageSrc: selectedGlasses?.imagePath ?? "",
      faceResult,
      displayW: displaySize.w * displaySize.dpr,
      displayH: displaySize.h * displaySize.dpr,
      selectedGlasses,
    });
  }, [photoImage, glassesImage, faceResult, displaySize, selectedGlasses]);

  if (status === "initializing" || (!displaySize && !photoImage)) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center w-full h-64 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Cargando motor de IA...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 w-full">
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={displaySize ? { width: displaySize.w, height: displaySize.h } : {}}
      >
        <canvas
          ref={canvasRef}
          width={displaySize ? displaySize.w * displaySize.dpr : 0}
          height={displaySize ? displaySize.h * displaySize.dpr : 0}
          style={displaySize ? { width: displaySize.w, height: displaySize.h } : {}}
          className="block"
        />

        {status === "processing" && (
          <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-3 rounded-2xl">
            <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-200 text-sm font-medium">Analizando rostro...</p>
          </div>
        )}
      </div>

      {status === "error" && errorMessage && (
        <div className="w-full max-w-md px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-red-400 text-sm text-center">{errorMessage}</p>
        </div>
      )}

      {status === "success" && !selectedGlasses && (
        <p className="text-slate-400 text-sm">
          Rostro detectado — selecciona un lente del catálogo
        </p>
      )}
    </div>
  );
}