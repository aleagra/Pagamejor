"use client";

import React from "react";
import { type Icon } from "@phosphor-icons/react";

interface InfoItemProps {
  icon: Icon;
  label: string;
  children: React.ReactNode;
  /** "aviso" para lo que hay que tener en cuenta sí o sí (ej. pagar con MODO). */
  tono?: "normal" | "aviso";
}

/** Par etiqueta/valor con el ícono en un círculo ("Tope de reintegro → $12.000 por semana"). */
export const InfoItem: React.FC<InfoItemProps> = ({ icon: Icono, label, children, tono = "normal" }) => (
  <div className="flex items-start gap-3.5 min-w-0">
    <span
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
        tono === "aviso" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
      }`}
      aria-hidden="true"
    >
      <Icono size={20} weight="bold" />
    </span>
    <div className="min-w-0 pt-px">
      <div className="text-base text-ink-3 leading-snug">{label}</div>
      <div className="text-base text-ink leading-snug">{children}</div>
    </div>
  </div>
);

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Semana en letras (L M X J V S D) con los días de la promo marcados. diasSemana usa 0 = domingo. */
export const DiasChips: React.FC<{ diasSemana: number[] }> = ({ diasSemana }) => {
  const activos = new Set(diasSemana.map((d) => (d + 6) % 7)); // 0 = lunes
  const texto = NOMBRES.filter((_, i) => activos.has(i)).join(", ");
  return (
    <span className="flex gap-1.5 mt-1" role="img" aria-label={`Días: ${texto}`}>
      {LETRAS.map((l, i) => (
        <span
          key={l}
          aria-hidden="true"
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-semibold ${
            activos.has(i) ? "bg-surface text-accent shadow-[0_0_0_1.5px_var(--color-accent)]" : "bg-panel text-ink-3/60"
          }`}
        >
          {l}
        </span>
      ))}
    </span>
  );
};
