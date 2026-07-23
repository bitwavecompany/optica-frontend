import { useState } from "react";
import type { UploadedPhoto, Glasses } from "@/types";
import { CameraUpload } from "@/components/CameraUpload";
import { GlassesCanvas } from "@/components/GlassesCanvas";
import { GlassesCatalog } from "@/components/GlassesCatalog";
import { TryOn3DView } from "@/components/TryOn3DView"; // ← agregar
import clsx from "clsx";                                // ← agregar

type AppMode = "photo" | "live3d"; // ← agregar

export default function App() {
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [selectedGlasses, setSelectedGlasses] = useState<Glasses | null>(null);
  const [appMode, setAppMode] = useState<AppMode>("photo"); // ← agregar

  function handlePhotoReady(newPhoto: UploadedPhoto) {
    setPhoto(newPhoto);
    setSelectedGlasses(null);
  }

  function handleReset() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setSelectedGlasses(null);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.574-3.007-9.964-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-slate-100 font-semibold text-base leading-tight">Probador Virtual</h1>
              <p className="text-slate-500 text-xs hidden sm:block">Encuentra tu estilo perfecto</p>
            </div>
          </div>

          {/* ── Selector de modo global ── */}
          <div className="flex bg-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setAppMode("photo")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                appMode === "photo"
                  ? "bg-brand-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              📷 Foto
            </button>
            <button
              onClick={() => setAppMode("live3d")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                appMode === "live3d"
                  ? "bg-brand-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              🎥 En vivo 3D
              <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded">BETA</span>
            </button>
          </div>

          {photo && appMode === "photo" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-150 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="hidden sm:inline">Nueva foto</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">

        {/* ══ MODO FOTO (comportamiento original) ══ */}
        {appMode === "photo" && (
          <>
            {!photo ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                <div className="text-center px-4">
                  <h2 className="text-slate-100 text-2xl font-semibold">
                    Pruébate lentes virtualmente
                  </h2>
                  <p className="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                    Sube una foto tuya y descubre qué modelo te queda mejor antes de comprar
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <CameraUpload onPhotoReady={handlePhotoReady} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-center lg:items-start w-full">
                <div className="flex-1 flex flex-col items-center gap-4 w-full">
                  <GlassesCanvas photo={photo} selectedGlasses={selectedGlasses} />
                </div>
                <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] flex flex-col">
                  <GlassesCatalog
                    selectedGlasses={selectedGlasses}
                    onSelect={setSelectedGlasses}
                  />
                </aside>
              </div>
            )}
          </>
        )}

        {/* ══ MODO EN VIVO 3D ══ */}
        {appMode === "live3d" && (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
            <div className="flex-1 flex flex-col gap-4 w-full">

              {/* Aviso si el lente seleccionado no tiene modelo 3D */}
              {selectedGlasses && !selectedGlasses.modelPath && (
                <div className="w-full px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-yellow-400 text-sm text-center">
                    ⚠️ Este modelo de lente no tiene archivo 3D todavía. Selecciona otro del catálogo.
                  </p>
                </div>
              )}

              <TryOn3DView selectedGlasses={selectedGlasses} />
            </div>

            <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] flex flex-col">
              <GlassesCatalog
                selectedGlasses={selectedGlasses}
                onSelect={setSelectedGlasses}
              />
            </aside>
          </div>
        )}

      </main>
    </div>
  );
}