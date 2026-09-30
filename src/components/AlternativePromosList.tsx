"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BancoBilletera } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { DescuentoTag } from "@/components/DescuentoTag";
import { EASE_OUT, useModoLiviano } from "@/components/MotionProvider";
import { metodoPago, resumenComercios, resumenTope } from "@/components/format";
import { MetodoPagoLinea } from "@/components/MetodoPago";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

interface AlternativePromosListProps {
  groups: GroupedBankPromo[];
  bancosMap: Record<string, BancoBilletera>;
  /** Banco con el desglose abierto (uno a la vez en toda la pantalla). */
  expandedId: string | null;
  onToggle: (bankId: string, elemento: HTMLElement | null) => void;
  /** Desglose por comercio y nivel de reintegro de un banco (PromoDetail). */
  renderDetalle: (g: GroupedBankPromo) => React.ReactNode;
  /** Celular: tocar una fila abre su desglose en una hoja que sube desde abajo en vez de expandirla. */
  abreHoja?: boolean;
}

interface FilaProps {
  g: GroupedBankPromo;
  banco?: BancoBilletera;
  idx: number;
  abierta: boolean;
  liviano: boolean;
  onToggle: (bankId: string, elemento: HTMLElement | null) => void;
  detalle: React.ReactNode;
  abreHoja: boolean;
}

function Fila({ g, banco, idx, abierta, liviano, onToggle, detalle, abreHoja }: FilaProps) {
  const resumen = [resumenComercios(g.niveles[0]?.items ?? g.variantes), resumenTope(g)].filter(Boolean).join(" · ");
  const metodo = metodoPago(g.bestPromo.medioPagoDetalle, g.bestPromo.condicionUso, g.bestPromo.tipoMedioRequerido);
  const detalleId = `detalle-${g.bancoBilleteraId}`;
  const filaRef = React.useRef<HTMLLIElement>(null);

  return (
    <motion.li
      ref={filaRef}
      className="relative"
      // En modo liviano las filas se muestran directo, sin esperar a entrar en pantalla
      initial={liviano ? false : { opacity: 0, y: 18 }}
      whileInView={liviano ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ type: "spring", bounce: 0.18, duration: 0.55, delay: 0.12 + Math.min(idx, 4) * 0.06 }}
    >
      {idx > 0 && <div className="absolute top-0 right-4 left-[76px] h-px bg-hairline" aria-hidden="true" />}
      <motion.button
        type="button"
        onClick={() => onToggle(g.bancoBilleteraId, filaRef.current)}
        aria-expanded={abreHoja ? undefined : abierta}
        aria-controls={abreHoja ? undefined : detalleId}
        aria-haspopup={abreHoja ? "dialog" : undefined}
        whileTap={{ scale: 0.99 }}
        className="group relative w-full flex items-center gap-4 pl-4 pr-3 py-3.5 min-h-[76px] text-left hover:bg-canvas/60 transition-colors duration-200"
      >
        <BankBadge banco={banco} />

        <span className="flex-1 min-w-0">
          {/* Un solo énfasis: el nombre (con su reintegro al lado). Lo demás, en el mismo tono secundario */}
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-[17px] font-semibold leading-snug text-ink truncate">{g.bancoBilleteraNombre}</span>
            <DescuentoTag porcentaje={g.maxPorcentaje} hasta={g.niveles.length > 1} hastaSoloEnGrande />
          </span>
          {resumen && <span className="block mt-0.5 text-base leading-snug text-ink-3 line-clamp-2 sm:line-clamp-1">{resumen}</span>}
          <MetodoPagoLinea metodo={metodo} className="mt-0.5" />
        </span>

        <motion.span
          animate={{ rotate: !abreHoja && abierta ? 180 : 0 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-3"
          aria-hidden="true"
        >
          {abreHoja ? <CaretRight size={18} weight="bold" /> : <CaretDown size={18} weight="bold" />}
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {abierta && !abreHoja && (
          <motion.div
            id={detalleId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 rounded-2xl bg-canvas px-4 sm:px-5 py-5">{detalle}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/**
 * El resto de la billetera en listas agrupadas: primero las billeteras virtuales (lo más usado para pagar) y
 * después los bancos, cada grupo de mayor a menor reintegro según el motor. Es la única estructura de
 * resultados: cada fila se abre en su lugar con su desglose, sin panel aparte que repita la información.
 */
export const AlternativePromosList: React.FC<AlternativePromosListProps> = ({
  groups,
  bancosMap,
  expandedId,
  onToggle,
  renderDetalle,
  abreHoja = false,
}) => {
  const { liviano } = useModoLiviano();
  if (groups.length === 0) return null;

  const secciones = [
    { titulo: "Billeteras virtuales", items: groups.filter((g) => bancosMap[g.bancoBilleteraId]?.tipo !== "banco") },
    { titulo: "Bancos", items: groups.filter((g) => bancosMap[g.bancoBilleteraId]?.tipo === "banco") },
  ].filter((s) => s.items.length > 0);

  return (
    <section className="mt-10" aria-labelledby="otras-title">
      <motion.div
        initial={liviano ? false : { opacity: 0, y: 16 }}
        whileInView={liviano ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="px-1 mb-4"
      >
        <h2 id="otras-title" className="display text-[22px] font-bold tracking-[-0.02em] text-ink">
          Otras opciones en tu billetera
        </h2>
        <p className="text-base text-ink-3">
          {groups.length === 1 ? "1 medio de pago más" : `${groups.length} medios de pago más`}. Tocá uno para ver
          sus comercios y cómo pagar.
        </p>
      </motion.div>

      <div className="flex flex-col gap-6">
        {secciones.map((sec) => (
          <div key={sec.titulo}>
            <h3 className="px-1 mb-2 text-base font-semibold text-ink-3">{sec.titulo}</h3>
            <ul className="bg-surface rounded-[24px] shadow-[var(--shadow-card)] overflow-hidden list-none py-1">
              {sec.items.map((g, idx) => (
                <Fila
                  key={g.bancoBilleteraId}
                  g={g}
                  banco={bancosMap[g.bancoBilleteraId]}
                  idx={idx}
                  abierta={expandedId === g.bancoBilleteraId}
                  liviano={liviano}
                  onToggle={onToggle}
                  detalle={renderDetalle(g)}
                  abreHoja={abreHoja}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
