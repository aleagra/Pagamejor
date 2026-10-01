"use client";

import React from "react";
import { motion } from "motion/react";
import { BancoBilletera } from "@/data/schema";
import { UpcomingPromo } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { DescuentoTag } from "@/components/DescuentoTag";
import { CaretRight, Coffee } from "@phosphor-icons/react";

interface EmptyStateProps {
  rubroNombre: string;
  /** "Hoy" o "El jueves". */
  cuando: string;
  upcomingPromos: UpcomingPromo[];
  bancosMap: Record<string, BancoBilletera>;
  onOpenWallet: () => void;
  /** Salta al día elegido (número de día de la semana, 0 = domingo). */
  onSelectDay: (diaSemana: number) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  rubroNombre,
  cuando,
  upcomingPromos,
  bancosMap,
  onOpenWallet,
  onSelectDay,
}) => {
  return (
    <div role="status">
      <motion.div
        className="tarjeta rounded-[28px] p-7 sm:p-8 max-w-2xl"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      >
        <motion.span
          className="aro w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center text-accent mb-5"
          initial={{ rotate: -18, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", bounce: 0.45, duration: 0.7, delay: 0.15 }}
          aria-hidden="true"
        >
          <Coffee size={26} />
        </motion.span>
        <h2 className="display text-[24px] sm:text-[26px] font-semibold leading-tight text-ink mb-2">
          {cuando} no tenés descuentos en {rubroNombre}
        </h2>
        <p className="text-[17px] leading-relaxed text-ink-2">
          Podés pagar con tu medio habitual: no te estás perdiendo ninguna promoción de tu billetera.
        </p>
      </motion.div>

      {upcomingPromos.length > 0 && (
        <section className="mt-10" aria-labelledby="proximos-title">
          <h3 id="proximos-title" className="display text-[24px] font-semibold text-ink mb-1 px-1">
            Otros días sí tenés descuento
          </h3>
          <p className="text-base text-ink-3 mb-4 px-1">Tocá un día para ver sus promociones en {rubroNombre}.</p>

          <ul className="tarjeta rounded-3xl overflow-hidden list-none max-w-2xl">
            {upcomingPromos.map((item, idx) => (
              <motion.li
                key={item.diaSemana}
                className="relative"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.18, duration: 0.55, delay: 0.2 + idx * 0.06 }}
              >
                {idx > 0 && <div className="absolute top-0 right-0 left-[80px] h-px bg-hairline" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => onSelectDay(item.diaSemana)}
                  className="w-full flex items-center gap-4 pl-5 pr-3 py-3.5 min-h-[72px] text-left hover:bg-canvas active:bg-fill transition-colors duration-200"
                >
                  <BankBadge banco={bancosMap[item.promo.bancoBilleteraId]} aro />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-semibold text-ink">{item.diaTexto}</span>
                    <span className="block text-base text-ink-3">{item.promo.bancoBilleteraNombre}</span>
                  </span>
                  <DescuentoTag porcentaje={item.promo.porcentajeDescuento} />
                  <CaretRight size={22} className="shrink-0 text-ink-3" aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="mt-8 min-h-12 px-5 rounded-full bg-surface shadow-[0_0_0_1px_var(--color-hairline)] text-base font-semibold text-ink hover:bg-fill-strong active:scale-[0.98] transition-[background-color,transform] duration-200"
        onClick={onOpenWallet}
      >
        Editar Mi billetera
      </button>
    </div>
  );
};
