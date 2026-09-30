"use client";

import React from "react";
import { Check } from "@phosphor-icons/react";
import { Sheet } from "@/components/Sheet";
import { fechaTexto } from "@/components/format";

interface OtroDiaSheetProps {
  isOpen: boolean;
  onClose: () => void;
  today: Date;
  /** Días hacia adelante desde hoy (0 = hoy). */
  offset: number;
  onChange: (offset: number) => void;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Vista secundaria para planificar otro día, fuera del flujo principal (la pantalla muestra siempre hoy).
 * Lista los próximos 7 días; elegir uno cierra la vista.
 */
export const OtroDiaSheet: React.FC<OtroDiaSheetProps> = ({ isOpen, onClose, today, offset, onChange }) => {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const fecha = capitalizar(fechaTexto(d));
    return { offset: i, titulo: i === 0 ? "Hoy" : i === 1 ? "Mañana" : fecha, detalle: i <= 1 ? fecha : null };
  });

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Ver otro día"
      description="Mirá qué promociones vas a tener para planificar una compra."
      cerrarAbajo
    >
      <ul className="bg-canvas rounded-3xl overflow-hidden list-none" role="radiogroup" aria-label="Día a consultar">
        {dias.map((d, idx) => {
          const activo = d.offset === offset;
          return (
            <li key={d.offset} className="relative">
              {idx > 0 && <div className="absolute top-0 right-0 left-4 h-px bg-hairline" aria-hidden="true" />}
              <button
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => {
                  onChange(d.offset);
                  onClose();
                }}
                className="w-full flex items-center gap-4 px-4 py-3 min-h-[64px] text-left hover:bg-fill/60 active:bg-fill transition-colors duration-200"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-lg font-semibold leading-snug text-ink">{d.titulo}</span>
                  {d.detalle && <span className="block text-base leading-snug text-ink-3">{d.detalle}</span>}
                </span>
                {activo && <Check size={22} weight="bold" className="shrink-0 text-accent" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
};
