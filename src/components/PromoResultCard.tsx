"use client";

import React from "react";
import { motion } from "motion/react";
import { BancoBilletera } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import {
  comparacionMismoPorcentaje,
  hayVariosPorcentajes,
  metodoPago,
  nombreVariante,
  resumenComercios,
  resumenTope,
} from "@/components/format";
import { MetodoPagoLinea } from "@/components/MetodoPago";
import { ArrowRight, SealCheck } from "@phosphor-icons/react";

interface PromoResultCardProps {
  group: GroupedBankPromo;
  banco?: BancoBilletera;
  /** "Tu mejor opción hoy" / "Tu mejor opción el jueves". */
  etiqueta: string;
  /** Las demás opciones del día: si alguna da exactamente lo mismo, se avisa que empatan. */
  alternativas: GroupedBankPromo[];
  /** Abre el desglose por comercio (hoja en el celular, ventana centrada en escritorio). */
  onAbrir: () => void;
}

/** "Comercios de cercanía, almacenes y tiendas de barrio" → "Comercios de cercanía": lo justo para el globito. */
function nombreCorto(nombre: string): string {
  return nombre.split(/,|\s\(|\s-\s/)[0].trim();
}

/**
 * La mejor opción en una sola franja: el reintegro grande a la izquierda, lo esencial en el medio (dónde,
 * cómo pagar, tope) y la acción a la derecha. Toda la tarjeta abre el detalle.
 */
export const PromoResultCard: React.FC<PromoResultCardProps> = ({ group, banco, etiqueta, alternativas, onAbrir }) => {
  const variosNiveles = hayVariosPorcentajes(group);
  const comercios = resumenComercios(group.niveles[0]?.items ?? group.variantes, 3);
  const best = group.bestPromo;
  const metodo = metodoPago(best.medioPagoDetalle, best.condicionUso, best.tipoMedioRequerido);
  // Globito sobre el botón: nombra un lugar concreto que no se ve en la tarjeta ("También 20% en Comercios de
  // cercanía y 4 más"), que invita más a abrir el detalle que un número suelto
  const nombreArriba = group.variantes[0] ? nombreVariante(group.variantes[0]) : "";
  const otros = group.niveles
    .flatMap((n) => n.items.map((v) => ({ pct: n.porcentaje, nombre: nombreCorto(nombreVariante(v)) })))
    .filter(
      (o, i, lista) => o.nombre !== nombreCorto(nombreArriba) && lista.findIndex((x) => x.nombre === o.nombre) === i,
    );
  const globitoDetalle =
    otros.length > 0
      ? `También ${otros[0].pct}% en ${otros[0].nombre}${otros.length > 1 ? ` y ${otros.length - 1} más` : ""}`
      : group.totalOpciones > 1
        ? "Hay más de una forma de pagar"
        : "Revisá cómo se paga y el tope";
  // El botón repite la invitación del globito; la cantidad de lugares la dice el globito
  const accion = "Ver todos los detalles";
  // Empate real con la mejor (mismo %, tope y mínimo): se dice, así no parece que gana por algo. Solo cuentan
  // las que dan su mismo porcentaje: dos de 30% que empatan entre ellas no empatan con una de 40%
  const empatados = alternativas.filter(
    (a) =>
      a.maxPorcentaje === group.maxPorcentaje &&
      comparacionMismoPorcentaje(a, [group, ...alternativas])?.tipo === "igual",
  ).length;

  return (
    <motion.button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      aria-label={`${etiqueta}: ${group.bancoBilleteraNombre}, ${variosNiveles ? "hasta " : ""}${group.maxPorcentaje}% de reintegro. ${globitoDetalle}. ${accion}.`}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      // Una sola estructura que se reacomoda con áreas de grilla:
      // - celular: franja menta arriba (banco a la izquierda, porcentaje grande a la derecha), datos y botón abajo
      // - tablet chica (sm): el porcentaje como columna a la izquierda, botón debajo de los datos
      // - desde iPad vertical (ipad, 800px): franja horizontal con el botón a la derecha
      className="tarjeta tarjeta-interactiva group w-full text-left rounded-[28px] overflow-hidden grid grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'cab_pct'_'datos_datos'_'accion_accion'] sm:grid-cols-[150px_minmax(0,1fr)] sm:[grid-template-areas:'pct_cab'_'pct_datos'_'pct_accion'] ipad:grid-cols-[170px_minmax(0,1fr)_auto] ipad:[grid-template-areas:'pct_cab_accion'_'pct_datos_accion']"
    >
      {/* El reintegro: el único dato grande */}
      <span className="[grid-area:pct] flex flex-col items-end sm:items-center justify-center text-right sm:text-center gap-0.5 pl-2 pr-4 py-4 sm:px-2 bg-accent-soft sm:bg-[linear-gradient(160deg,var(--color-accent-soft),#F2FAF6)] text-accent-strong sm:border-r sm:border-accent-line">
        {variosNiveles && <span className="text-base font-semibold leading-none">hasta</span>}
        <AnimatedNumber
          value={group.maxPorcentaje}
          suffix="%"
          className="display text-[38px] min-[380px]:text-[44px] sm:text-[48px] font-bold leading-none tabular-nums"
        />
        <span className="text-base font-medium leading-tight whitespace-nowrap">de reintegro</span>
      </span>

      {/* Cabecera: etiqueta y banco (en el celular, dentro de la franja menta junto al porcentaje) */}
      <span className="[grid-area:cab] min-w-0 flex flex-col gap-1.5 pl-4 pr-2 py-4 sm:px-6 sm:pt-4 sm:pb-1 bg-accent-soft sm:bg-transparent">
        <span className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 leading-6">
          <span className="inline-flex items-center gap-1.5 text-base leading-6 font-semibold text-accent-strong">
            <SealCheck size={18} weight="fill" aria-hidden="true" />
            {etiqueta}
          </span>
          {/* Empate: texto gris a secas al lado de la etiqueta, sin recuadro */}
          {empatados > 0 && (
            <span className="text-base leading-6 text-ink-3">
              Empata con {empatados === 1 ? "1 opción más" : `${empatados} opciones más`}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 min-w-0 mt-1">
          <BankBadge banco={banco} aro />
          <span className="display min-w-0 text-[22px] sm:text-[24px] font-semibold leading-tight text-ink">
            {group.bancoBilleteraNombre}
          </span>
        </span>
      </span>

      {/* Dónde, cómo pagar y tope: todo en el mismo tono secundario */}
      <span className="[grid-area:datos] min-w-0 flex flex-col gap-1 px-4 pt-4 sm:px-6 sm:pt-1.5 ipad:pb-4">
        {comercios && <span className="text-base leading-snug text-ink-3 line-clamp-2">{comercios}</span>}
        <span className="flex flex-col ipad:flex-row ipad:flex-wrap gap-x-4 gap-y-1">
          <MetodoPagoLinea metodo={metodo} />
          <span className="text-base leading-snug text-ink-3">{resumenTope(group)}</span>
        </span>
      </span>

      {/* Acción: abajo y a todo el ancho en el celular, a la derecha desde iPad vertical (800px) */}
      <span className="[grid-area:accion] flex flex-col items-stretch sm:items-start ipad:items-end justify-center gap-2.5 px-4 pt-4 pb-4 sm:px-6 sm:pt-3 sm:pb-5 ipad:py-4 ipad:pl-0 ipad:pr-6 lg:pr-7">
        {/* Globito que señala el botón: aparece una vez, un instante después de la tarjeta, y queda quieto */}
        <motion.span
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.5, delay: 0.7 }}
          className="relative sm:max-w-[300px] ipad:max-w-[260px] lg:max-w-[300px] rounded-2xl bg-surface px-3.5 py-2 text-base leading-snug text-ink-2 shadow-[0_0_0_1px_rgb(19_21_23/0.1),0_8px_20px_rgb(19_21_23/0.08)]"
        >
          <span className="block font-semibold text-ink">Mirá los detalles antes de pagar</span>
          <span className="block">{globitoDetalle}</span>
          {/* Piquito que apunta al botón */}
          <span
            className="absolute -bottom-[6px] left-8 ipad:left-auto ipad:right-10 w-3 h-3 rotate-45 bg-surface shadow-[1px_1px_0_0_rgb(19_21_23/0.1)]"
            aria-hidden="true"
          />
        </motion.span>
        <span
          data-tour="ver-detalles"
          className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-full bg-action text-white text-base font-semibold whitespace-nowrap shadow-[0_6px_16px_rgb(19_21_23/0.2)] transition-[background-color,box-shadow] duration-200 group-hover:bg-action-strong"
        >
          {accion}
          <ArrowRight
            size={18}
            weight="bold"
            className="transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </span>
    </motion.button>
  );
};
