"use client";

import React from "react";
import { QrCode } from "lucide-react";
import { Promocion } from "@/data/schema";

/** True si la promo se cobra pagando con MODO (billetera MODO o promo de un banco vía MODO). */
export function requiereModo(promo: Pick<Promocion, "id" | "bancoBilleteraId" | "medioPagoDetalle">): boolean {
  return (
    promo.bancoBilleteraId === "modo" ||
    promo.id.startsWith("modo-") ||
    /\bMODO\b/.test(promo.medioPagoDetalle)
  );
}

interface ModoAvisoProps {
  promo: Pick<Promocion, "id" | "bancoBilleteraId" | "bancoBilleteraNombre" | "medioPagoDetalle">;
  /** Versión compacta para las opciones alternativas. */
  compacto?: boolean;
}

/**
 * Aviso para promos que se pagan con MODO: MODO no es una tarjeta, es una app que se vincula a una tarjeta
 * de un banco adherido, y la promo solo aplica pagando con su QR.
 */
export const ModoAviso: React.FC<ModoAvisoProps> = ({ promo, compacto = false }) => {
  if (!requiereModo(promo)) return null;

  const esModoPuro = promo.bancoBilleteraId === "modo";
  const titulo = esModoPuro
    ? "Esta promo se paga con MODO"
    : `Esta promo se paga con MODO usando tu tarjeta de ${promo.bancoBilleteraNombre}`;
  const pasos = esModoPuro
    ? "Tené la app MODO (o la app de tu banco, si ya trae MODO) con una tarjeta de un banco adherido vinculada. En la caja, pagá escaneando el código QR."
    : `Vinculá tu tarjeta de ${promo.bancoBilleteraNombre} a la app MODO (o usá la app del banco si ya trae MODO) y pagá escaneando el código QR en la caja. Pagando con la tarjeta sola no se aplica.`;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-2 border-terracotta-border bg-terracotta-bg ${
        compacto ? "p-3" : "p-4 sm:p-5"
      }`}
      role="note"
    >
      <QrCode className="shrink-0 text-terracotta mt-0.5" size={compacto ? 20 : 24} aria-hidden="true" />
      <div className={compacto ? "text-sm" : "text-base sm:text-lg"}>
        <div className="font-extrabold text-text-main leading-snug">{titulo}</div>
        <p className="text-text-secondary leading-relaxed mt-1 m-0">{pasos}</p>
      </div>
    </div>
  );
};
