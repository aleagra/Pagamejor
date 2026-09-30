import React from "react";

interface DescuentoTagProps {
  porcentaje: number;
  /** Muestra "hasta" cuando el banco tiene varios porcentajes según el comercio. */
  hasta?: boolean;
  /** En pantallas chicas el "hasta" se oculta para dejarle lugar al nombre. */
  hastaSoloEnGrande?: boolean;
}

/** Etiqueta verde de descuento: el único uso del verde en la app es "esto es tu reintegro". */
export const DescuentoTag: React.FC<DescuentoTagProps> = ({ porcentaje, hasta = false, hastaSoloEnGrande = false }) => (
  <span
    className="inline-flex items-baseline gap-1 shrink-0 rounded-xl bg-accent-soft px-2.5 py-1 text-accent-strong whitespace-nowrap"
    aria-label={`${hasta ? "hasta " : ""}${porcentaje}% de reintegro`}
  >
    {hasta && (
      <span className={`text-base font-semibold ${hastaSoloEnGrande ? "hidden sm:inline" : ""}`} aria-hidden="true">
        hasta
      </span>
    )}
    <span className="display text-[20px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums" aria-hidden="true">
      {porcentaje}%
    </span>
  </span>
);
