"use client";

import React from "react";
import { Rubro, RubroId } from "@/data/schema";
import { LayoutGrid } from "lucide-react";

interface RubroSelectorProps {
  rubros: Rubro[];
  selectedRubro: RubroId;
  onSelectRubro: (rubroId: RubroId) => void;
  onOpenAllRubros: () => void;
}

export const RubroSelector: React.FC<RubroSelectorProps> = ({
  rubros,
  selectedRubro,
  onSelectRubro,
  onOpenAllRubros,
}) => {
  // Las 6 categorías destacadas para la grilla principal
  const rubrosPrincipales = rubros.filter((r) => r.esDestacado);

  // Verificamos si el rubro seleccionado actualmente está fuera de los 6 principales
  const esRubroSecundarioSeleccionado = !rubrosPrincipales.some(
    (r) => r.id === selectedRubro
  );
  const rubroSecundarioActual = esRubroSecundarioSeleccionado
    ? rubros.find((r) => r.id === selectedRubro)
    : null;

  return (
    <section className="mb-7" aria-labelledby="rubro-title">
      <div className="flex justify-between items-baseline mb-3">
        <span id="rubro-title" className="block text-xl font-bold text-text-main">
          1. Seleccioná qué vas a comprar hoy:
        </span>
        <button
          type="button"
          onClick={onOpenAllRubros}
          className="text-sm font-bold text-forest hover:underline hidden sm:inline-block"
        >
          Ver todos ({rubros.length})
        </button>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
        role="radiogroup"
        aria-labelledby="rubro-title"
      >
        {rubrosPrincipales.map((r) => {
          const isSelected = r.id === selectedRubro;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`flex flex-col items-center justify-center p-3.5 min-h-[92px] rounded-xl border-2 text-center transition-all shadow-xs ${
                isSelected
                  ? "border-forest bg-forest-bg shadow-sm"
                  : "border-border-subtle bg-surface hover:border-border-strong hover:bg-surface-elevated"
              }`}
              onClick={() => onSelectRubro(r.id)}
            >
              <span className="text-3xl leading-none mb-2" aria-hidden="true">
                {r.icono}
              </span>
              <span
                className={`text-base font-bold ${
                  isSelected ? "text-forest" : "text-text-main"
                }`}
              >
                {r.nombre}
              </span>
            </button>
          );
        })}

        {/* Botón escalable: Ver todos los rubros */}
        <button
          type="button"
          onClick={onOpenAllRubros}
          className={`flex flex-col items-center justify-center p-3.5 min-h-[92px] rounded-xl border-2 text-center transition-all shadow-xs ${
            esRubroSecundarioSeleccionado
              ? "border-forest bg-forest-bg shadow-sm"
              : "border-dashed border-border-strong bg-surface hover:bg-surface-elevated"
          }`}
          aria-label={
            esRubroSecundarioSeleccionado
              ? `Rubro actual: ${rubroSecundarioActual?.nombre}. Tocar para cambiar de rubro.`
              : "Ver catálogo completo de rubros de compra"
          }
        >
          {esRubroSecundarioSeleccionado && rubroSecundarioActual ? (
            <>
              <span className="text-3xl leading-none mb-2" aria-hidden="true">
                {rubroSecundarioActual.icono}
              </span>
              <span className="text-base font-bold text-forest">
                {rubroSecundarioActual.nombre}
              </span>
            </>
          ) : (
            <>
              <LayoutGrid className="text-forest mb-2" size={28} />
              <span className="text-base font-bold text-forest">
                Ver todos los rubros
              </span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};
