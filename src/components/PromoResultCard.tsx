"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BancoBilletera } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { metodoPago, resumenComercios, resumenTope } from "@/components/format";
import { MetodoPagoLinea } from "@/components/MetodoPago";
import { CaretDown, CaretRight, SealCheck } from "@phosphor-icons/react";

interface PromoResultCardProps {
  group: GroupedBankPromo;
  banco?: BancoBilletera;
  /** "Tu mejor opción hoy" / "Tu mejor opción el jueves". */
  etiqueta: string;
  /** El desglose por comercio se abre en el lugar, dentro de la tarjeta (sin panel aparte). */
  abierto: boolean;
  onToggle: () => void;
  /** Desglose por comercio y nivel de reintegro (PromoDetail). */
  detalle: React.ReactNode;
  /** Celular: el botón abre el desglose en una hoja que sube desde abajo en vez de expandirlo acá. */
  abreHoja?: boolean;
}

/**
 * La mejor opción como un cupón: el reintegro en el talón verde y, a la derecha, solo lo esencial en un tono
 * secundario uniforme (dónde, cómo pagar, tope). El desglose se abre dentro de la misma tarjeta.
 */
export const PromoResultCard: React.FC<PromoResultCardProps> = ({
  group,
  banco,
  etiqueta,
  abierto,
  onToggle,
  detalle,
  abreHoja = false,
}) => {
  const variosNiveles = group.niveles.length > 1;
  const comercios = resumenComercios(group.niveles[0]?.items ?? group.variantes, 3);
  const best = group.bestPromo;
  const metodo = metodoPago(best.medioPagoDetalle, best.condicionUso, best.tipoMedioRequerido);
  const detalleId = `detalle-${group.bancoBilleteraId}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      className="relative bg-surface rounded-[28px] shadow-[var(--shadow-card)]"
      aria-label={`${etiqueta}: ${group.bancoBilleteraNombre}, ${variosNiveles ? "hasta " : ""}${group.maxPorcentaje}% de reintegro`}
    >
      <div className="relative grid grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[148px_minmax(0,1fr)]">
        {/* Talón del cupón: el único dato grande */}
        <div className="flex flex-col items-center justify-center text-center gap-1 rounded-tl-[28px] bg-accent-soft text-accent-strong px-2 py-6">
          {variosNiveles && <span className="text-base font-semibold leading-none">hasta</span>}
          <AnimatedNumber
            value={group.maxPorcentaje}
            suffix="%"
            className="display text-[40px] sm:text-[52px] font-extrabold leading-none tracking-[-0.045em] tabular-nums"
          />
          <span className="text-base font-semibold leading-tight">de reintegro</span>
        </div>

        {/* Cuerpo: título y, debajo, todo en el mismo tono secundario */}
        <div className="min-w-0 flex flex-col gap-1.5 p-4 sm:p-6 border-l-2 border-dashed border-fill-strong">
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-accent-strong">
            <SealCheck size={18} weight="fill" aria-hidden="true" />
            {etiqueta}
          </span>
          <div className="flex items-center gap-3 min-w-0 mt-1 mb-1">
            <BankBadge banco={banco} />
            <h2 className="display min-w-0 text-[22px] sm:text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {group.bancoBilleteraNombre}
            </h2>
          </div>
          {comercios && <p className="text-base leading-snug text-ink-3 line-clamp-2">{comercios}</p>}
          <MetodoPagoLinea metodo={metodo} />
          <p className="text-base text-ink-3">{resumenTope(group)}</p>
        </div>

        {/* Muesca del cupón sobre la línea punteada */}
        <span
          className="absolute -top-3 left-[104px] sm:left-[148px] -translate-x-1/2 w-6 h-6 rounded-full bg-canvas shadow-[inset_0_-1px_0_rgb(19_21_23/0.06)]"
          aria-hidden="true"
        />
      </div>

      {/* Ver el desglose en el lugar */}
      <div className="border-t border-hairline">
        <motion.button
          type="button"
          onClick={onToggle}
          aria-expanded={abreHoja ? undefined : abierto}
          aria-controls={abreHoja ? undefined : detalleId}
          aria-haspopup={abreHoja ? "dialog" : undefined}
          whileTap={{ scale: 0.99 }}
          className={`w-full min-h-14 px-5 sm:px-6 flex items-center justify-between gap-3 text-[17px] font-semibold text-ink hover:bg-canvas/60 transition-colors duration-200 ${
            abierto ? "" : "rounded-b-[28px]"
          }`}
        >
          <span>
            {abierto
              ? "Ocultar detalle"
              : group.totalOpciones > 1
                ? `Ver las ${group.totalOpciones} opciones y cómo pagar`
                : "Ver cómo pagar"}
          </span>
          <motion.span
            animate={{ rotate: !abreHoja && abierto ? 180 : 0 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
            className="shrink-0 w-9 h-9 rounded-full bg-panel flex items-center justify-center text-ink-2"
            aria-hidden="true"
          >
            {abreHoja ? <CaretRight size={18} weight="bold" /> : <CaretDown size={18} weight="bold" />}
          </motion.span>
        </motion.button>

        <AnimatePresence initial={false}>
          {abierto && !abreHoja && (
            <motion.div
              id={detalleId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 sm:px-6 pb-6 pt-2">{detalle}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};
