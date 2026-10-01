"use client";

import React, { useState } from "react";
import { BancoBilletera } from "@/data/schema";

interface BankBadgeProps {
  banco?: BancoBilletera;
  size?: "sm" | "md" | "lg";
  /** Aro verde alrededor del círculo, para las tarjetas de resultados. */
  aro?: boolean;
}

const SIZES = {
  sm: "w-10 h-10 text-[10px]",
  md: "w-11 h-11 text-[11px]",
  lg: "w-12 h-12 text-xs",
};

/**
 * Único tratamiento visual de bancos y billeteras en toda la app (resultado, lista, detalle, Mi billetera):
 * un círculo con el logo oficial (public/logos/<id>.webp) y, si falta, las siglas sobre
 * el color de marca, con la misma forma, tamaño y borde. Decorativo: el nombre siempre va al lado.
 */
export const BankBadge: React.FC<BankBadgeProps> = ({ banco, size = "md", aro = false }) => {
  const [sinImagen, setSinImagen] = useState(false);
  if (!banco) return null;

  const base = `${SIZES[size]} relative inline-flex shrink-0 overflow-hidden rounded-full ${aro ? "aro" : ""}`;
  const borde = (
    <span className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.07)]" aria-hidden="true" />
  );

  if (sinImagen) {
    return (
      <span
        className={`${base} items-center justify-center font-black tracking-tight`}
        style={{ backgroundColor: banco.colorPrimario, color: banco.colorTexto }}
        aria-hidden="true"
      >
        {banco.siglas}
        {borde}
      </span>
    );
  }

  return (
    <span className={`${base} bg-surface`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- íconos locales de 5KB, no necesitan optimización */}
      <img
        src={`/logos/${banco.id}.webp`}
        alt=""
        width={56}
        height={56}
        decoding="async"
        className="w-full h-full object-cover"
        onError={() => setSinImagen(true)}
      />
      {borde}
    </span>
  );
};
