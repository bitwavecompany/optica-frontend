import type { Glasses } from "@/types";
import { categoriaLabels } from "@/data/glasses";
import clsx from "clsx";

interface GlassesCardProps {
  glasses: Glasses;
  selected: boolean;
  onSelect: (glasses: Glasses) => void;
}

export function GlassesCard({ glasses, selected, onSelect }: GlassesCardProps) {
  return (
    <button
      onClick={() => onSelect(glasses)}
      className={clsx(
        "w-full rounded-xl p-3 text-left transition-all duration-200",
        "border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900",
        selected
          ? "border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20"
          : "border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800"
      )}
    >
      <div className="w-full h-20 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden mb-3">
        <img
          src={glasses.imagePath}
          alt={glasses.name}
          className="w-full h-full object-contain p-2"
          loading="lazy"
          draggable={false}
        />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-slate-100 text-sm font-medium truncate">{glasses.name}</p>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{glasses.brand}</p>
        </div>

        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
          {categoriaLabels[glasses.category]}
        </span>
      </div>

      {selected && (
        <div className="mt-2 flex items-center gap-1.5 text-brand-500">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-medium">Seleccionado</span>
        </div>
      )}
    </button>
  );
}