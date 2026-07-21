import { useState } from "react";
import type { Glasses, GlassesCategory } from "@/types";
import { glassesCatalog, categoriaLabels } from "@/data/glasses";
import { GlassesCard } from "@/components/GlassesCard";
import clsx from "clsx";

interface GlassesCatalogProps {
  selectedGlasses: Glasses | null;
  onSelect: (glasses: Glasses) => void;
  disabled?: boolean;
}

const CATEGORIES: Array<{ value: GlassesCategory | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "sol", label: categoriaLabels["sol"] },
  { value: "graduados", label: categoriaLabels["graduados"] },
  { value: "deportivos", label: categoriaLabels["deportivos"] },
];

export function GlassesCatalog({ selectedGlasses, onSelect, disabled = false }: GlassesCatalogProps) {
  const [activeCategory, setActiveCategory] = useState<GlassesCategory | "todos">("todos");

  const filtered = activeCategory === "todos"
    ? glassesCatalog
    : glassesCatalog.filter((g) => g.category === activeCategory);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="mb-4">
        <h2 className="text-slate-100 font-semibold text-lg">Catálogo de Lentes</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          {disabled ? "Sube una foto para comenzar" : "Selecciona un modelo para probártelo"}
        </p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            disabled={disabled}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-slate-900",
              activeCategory === cat.value
                ? "bg-brand-500 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600",
              disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div
        className={clsx(
          "grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-3 overflow-y-auto scrollbar-hide flex-1 pb-4 lg:pb-0",
          disabled ? "opacity-40 pointer-events-none" : ""
        )}
      >
        {filtered.map((glasses) => (
          <GlassesCard
            key={glasses.id}
            glasses={glasses}
            selected={selectedGlasses?.id === glasses.id}
            onSelect={onSelect}
          />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 col-span-full text-slate-500 text-sm">
            <p>No hay lentes en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}