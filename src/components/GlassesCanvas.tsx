import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import type { UploadedPhoto, Glasses, GlassesTransform, FaceDetectionResult } from "@/types";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { calcularPosicionLentes } from "@/lib/faceUtils";

interface GlassesCanvasProps {
  photo: UploadedPhoto;
  selectedGlasses: Glasses | null;
}

const MAX_DISPLAY_HEIGHT = 600;

export function GlassesCanvas({ photo, selectedGlasses }: GlassesCanvasProps) {
  const { detect, status, errorMessage } = useFaceDetection();

  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [glassesImage, setGlassesImage] = useState<HTMLImageElement | null>(null);
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const detectedForUrl = useRef<string | null>(null);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }
    window.addEventListener("resize", updateWidth);
    updateWidth();
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      img.width = img.naturalWidth;
      img.height = img.naturalHeight;
      setPhotoImage(img);
    };
    img.src = photo.url;
  }, [photo.url]);

  useEffect(() => {
    if (!photoImage || status === "initializing") return;
    if (detectedForUrl.current === photo.url) return;

    const runDetection = async () => {
      detectedForUrl.current = photo.url;
      const result = await detect(photoImage);
      setFaceResult(result);
    };

    runDetection();
  }, [photoImage, photo.url, status, detect]);

  useEffect(() => {
    if (!selectedGlasses) return;

    const img = new Image();
    img.onload = () => {
      img.width = img.naturalWidth;
      img.height = img.naturalHeight;
      setGlassesImage(img);
    };
    img.onerror = () => {
      console.error("Error al cargar la imagen de los lentes. Revisa la ruta:", selectedGlasses.imagePath);
    };
    img.src = selectedGlasses.imagePath;
  }, [selectedGlasses?.id]);

  let displaySize: { w: number; h: number } | null = null;
  
  if (photoImage && containerWidth > 0) {
    const maxWidth = Math.min(containerWidth, 800);
    const widthRatio = maxWidth / photoImage.naturalWidth;
    const heightRatio = MAX_DISPLAY_HEIGHT / photoImage.naturalHeight;
    
    const ratio = Math.min(widthRatio, heightRatio, 1);
    
    displaySize = {
      w: Math.round(photoImage.naturalWidth * ratio),
      h: Math.round(photoImage.naturalHeight * ratio)
    };
  }

  const transform: GlassesTransform | null =
      faceResult && selectedGlasses && displaySize && glassesImage
        ? calcularPosicionLentes(
            faceResult.landmarks,
            displaySize.w,
            displaySize.h,
            glassesImage.naturalWidth / glassesImage.naturalHeight
          )
        : null;

  const glassesX = transform ? transform.x + transform.width / 2 : 0;
  const glassesY = transform ? transform.y + transform.height / 2 : 0;

  if (!displaySize || !photoImage || status === "initializing") {
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
        style={{ width: displaySize.w, height: displaySize.h }}
      >
        <Stage width={displaySize.w} height={displaySize.h}>
          <Layer>
            <KonvaImage
              image={photoImage}
              width={displaySize.w}
              height={displaySize.h}
            />
            {glassesImage && transform && (
              <KonvaImage
                image={glassesImage}
                x={glassesX}
                y={glassesY}
                width={transform.width}
                height={transform.height}
                rotation={transform.rotation}
                offsetX={transform.width / 2}
                offsetY={transform.height / 2}
              />
            )}
          </Layer>
        </Stage>

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