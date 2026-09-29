"use client";

import React from "react";
import { UpcomingPromo } from "@/logic/types";

interface EmptyStateProps {
  rubroNombre: string;
  nombreDia: string;
  upcomingPromos: UpcomingPromo[];
  onOpenWallet: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  rubroNombre,
  nombreDia,
  upcomingPromos,
  onOpenWallet,
}) => {
  return (
    <div className="bg-surface border-2 border-dashed border-border-strong rounded-2xl p-6 sm:p-8 text-center mb-6" role="status">
      <div className="text-5xl mb-3 leading-none" aria-hidden="true">
        ☕
      </div>
      <h2 className="text-xl sm:text-2xl font-extrabold text-text-main mb-2">
        Hoy {nombreDia} no tenés descuentos en {rubroNombre}
      </h2>
      <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-md mx-auto mb-5">
        Podés pagar con tu medio habitual sin perderte ninguna promoción bancaria activa en tu billetera.
      </p>

      {upcomingPromos.length > 0 && (
        <div className="bg-surface-elevated border border-border-subtle rounded-xl p-4 sm:p-5 text-left max-w-lg mx-auto mt-4">
          <div className="text-sm font-bold text-text-main mb-2.5">
            Tus tarjetas tienen promociones en {rubroNombre} otros días:
          </div>
          <div className="flex flex-col gap-2">
            {upcomingPromos.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-sm sm:text-base text-text-secondary border-b border-border-subtle border-dotted pb-1.5 last:border-b-0 last:pb-0"
              >
                <div>
                  <span className="font-bold text-terracotta">{item.diaTexto}:</span>{" "}
                  <span>{item.promo.bancoBilleteraNombre}</span>
                </div>
                <span className="font-bold text-forest">
                  {item.promo.porcentajeDescuento}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="mt-6 bg-transparent border-2 border-border-strong rounded-xl px-5 py-3 text-base font-bold text-text-main hover:border-forest hover:text-forest hover:bg-forest-bg transition-all"
        onClick={onOpenWallet}
      >
        ¿Sumaste una tarjeta nueva? Modificar Mi Billetera
      </button>
    </div>
  );
};
