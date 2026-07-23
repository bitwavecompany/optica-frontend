import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { FaceTrackingResult } from "@/hooks/useVideoFaceTracking";
import type { Glasses } from "@/types";
import { GlassesScene } from "@/components/GlassesScene";

interface GlassesCanvas3DProps {
  trackingResult: FaceTrackingResult | null;
  selectedGlasses: Glasses | null;
  width: number;
  height: number;
}

export function GlassesCanvas3D({
  trackingResult,
  selectedGlasses,
  width,
  height,
}: GlassesCanvas3DProps) {
  if (width === 0 || height === 0) return null;

  const hasModel = Boolean(selectedGlasses?.modelPath) && trackingResult !== null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        transform: "scaleX(-1)",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%" }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
        }}
        camera={{
          fov: 60,
          near: 0.001,
          far: 100,
          position: [0, 0, 1],
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          {hasModel && (
            <GlassesScene
              modelPath={selectedGlasses!.modelPath!}
              trackingResult={trackingResult!}
              videoWidth={width}
              videoHeight={height}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}