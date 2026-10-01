"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { BancoBilletera } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { DescuentoTag } from "@/components/DescuentoTag";
import { EASE_OUT, useModoLiviano } from "@/components/MotionProvider";
import {
  type ComparacionMismoPorcentaje,
  comparacionMismoPorcentaje,
  hayVariosPorcentajes,
  metodoPago,
  resumenComercios,
  resumenTope,
} from "@/components/format";
import { MetodoPagoLinea } from "@/components/MetodoPago";
import { ArrowRight } from "@phosphor-icons/react";

interface AlternativePromosListProps {
  groups: GroupedBankPromo[];
  /** La mejor opción del día: con ella se comparan los que dan el mismo porcentaje. */
  mejor: GroupedBankPromo;
  bancosMap: Record<string, BancoBilletera>;
  /** Abre el desglose de un banco (hoja en el celular, ventana centrada en escritorio). */
  onAbrir: (bankId: string) => void;
}

type Filtro = "todas" | "billeteras" | "bancos";

/** Por qué quedó detrás de otro con el mismo %: una línea gris corta bajo el nombre. */
// Se dice el dato, sin nombrar a otra tarjeta ni repetir el % (ya está en la etiqueta verde de al lado)
const COMPARACION: Record<ComparacionMismoPorcentaje["tipo"], string> = {
  igual: "Mismo % y tope",
  "menor-tope": "Mismo %, menor tope",
  "mayor-minimo": "Mismo %, pide mínimo",
};

function Tarjeta({
  g,
  banco,
  idx,
  liviano,
  onAbrir,
  comparacion,
}: {
  g: GroupedBankPromo;
  banco?: BancoBilletera;
  idx: number;
  liviano: boolean;
  onAbrir: (bankId: string) => void;
  comparacion: ComparacionMismoPorcentaje | null;
}) {
  // Todos los lugares del banco (de mayor a menor reintegro), para que no parezca que es uno solo
  const comercios = resumenComercios(g.variantes, 1);
  const metodo = metodoPago(g.bestPromo.medioPagoDetalle, g.bestPromo.condicionUso, g.bestPromo.tipoMedioRequerido);
  const opciones = g.totalOpciones === 1 ? "1 opción" : `${g.totalOpciones} opciones`;
  const nota = comparacion ? COMPARACION[comparacion.tipo] : null;

  return (
    <motion.li
      className="flex"
      // En modo liviano las tarjetas se muestran directo, sin esperar a entrar en pantalla
      initial={liviano ? false : { opacity: 0, y: 18 }}
      whileInView={liviano ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ type: "spring", bounce: 0.18, duration: 0.55, delay: 0.08 + Math.min(idx, 5) * 0.05 }}
    >
      <button
        type="button"
        onClick={() => onAbrir(g.bancoBilleteraId)}
        aria-haspopup="dialog"
        className="tarjeta tarjeta-interactiva group w-full flex flex-col gap-2 rounded-3xl p-4 sm:p-5 text-left"
      >
        {/* Un solo énfasis: el nombre, con su reintegro al lado. Lo demás, en el mismo tono secundario */}
        <span className="flex items-center gap-3 w-full">
          <BankBadge banco={banco} aro />
          <span className="flex-1 min-w-0">
            <span className="block text-[17px] font-semibold leading-snug text-ink line-clamp-2">
              {g.bancoBilleteraNombre}
            </span>
            {/* Si da el mismo % que otro de más arriba, por qué quedó detrás (entra en el alto del logo) */}
            {nota && <span className="block text-base leading-snug text-ink-3 line-clamp-2">{nota}</span>}
          </span>
          <DescuentoTag porcentaje={g.maxPorcentaje} hasta={hayVariosPorcentajes(g)} hastaSoloEnGrande />
        </span>

        <span className="flex flex-col gap-0.5">
          {comercios && <span className="text-base leading-snug text-ink-3 line-clamp-2">{comercios}</span>}
          <MetodoPagoLinea metodo={metodo} />
        </span>

        <span className="mt-auto pt-2.5 border-t border-hairline flex items-center justify-between gap-3 w-full">
          <span className="text-base leading-snug text-ink-3">{resumenTope(g)}</span>
          <span className="shrink-0 inline-flex items-center gap-1 text-base font-semibold text-ink">
            <span className="sr-only sm:not-sr-only">{opciones}</span>
            <ArrowRight
              size={17}
              weight="bold"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </span>
      </button>
    </motion.li>
  );
}

/**
 * El resto de la billetera en una grilla de tarjetas (una columna en el celular, hasta tres en escritorio),
 * siempre de mayor a menor descuento en el orden del motor. Si hay billeteras y bancos, se puede filtrar.
 */
export const AlternativePromosList: React.FC<AlternativePromosListProps> = ({ groups, mejor, bancosMap, onAbrir }) => {
  const { liviano } = useModoLiviano();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  if (groups.length === 0) return null;

  const billeteras = groups.filter((g) => bancosMap[g.bancoBilleteraId]?.tipo !== "banco");
  const bancos = groups.filter((g) => bancosMap[g.bancoBilleteraId]?.tipo === "banco");
  const hayAmbos = billeteras.length > 0 && bancos.length > 0;
  const actual = !hayAmbos ? "todas" : filtro;
  const visibles = actual === "billeteras" ? billeteras : actual === "bancos" ? bancos : groups;
  const ordenados = [mejor, ...groups];

  const filtros: { id: Filtro; titulo: string; cantidad: number }[] = [
    { id: "todas", titulo: "Todas", cantidad: groups.length },
    { id: "billeteras", titulo: "Billeteras virtuales", cantidad: billeteras.length },
    { id: "bancos", titulo: "Bancos", cantidad: bancos.length },
  ];

  return (
    <section className="mt-8 bajo:mt-6" aria-labelledby="otras-title">
      <motion.div
        initial={liviano ? false : { opacity: 0, y: 16 }}
        whileInView={liviano ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="flex flex-col tab:flex-row tab:items-end tab:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5"
      >
        <div className="px-1">
          <h2 id="otras-title" className="display text-[24px] font-semibold text-ink">
            Otras opciones en tu billetera
          </h2>
          <p className="text-base text-ink-3">
            {groups.length === 1 ? "1 medio de pago más" : `${groups.length} medios de pago más`}
            <span className="hidden sm:inline">. Tocá uno para ver sus comercios y cómo pagar</span>.
          </p>
        </div>

        {hayAmbos && (
          <div role="radiogroup" aria-label="Mostrar" className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2">
            {filtros.map((f) => {
              const activo = actual === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setFiltro(f.id)}
                  className={`inline-flex items-center justify-center gap-2 min-h-12 px-2 sm:px-4 rounded-full text-base font-semibold transition-[background-color,color,box-shadow] duration-200 ${
                    activo
                      ? "bg-action text-white shadow-[0_6px_16px_rgb(19_21_23/0.18)]"
                      : "bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)] hover:shadow-[0_0_0_1px_var(--color-fill-strong)]"
                  }`}
                >
                  {f.id === "billeteras" ? (
                    // En el celular, "Billeteras" a secas y sin cantidades, para que los tres filtros entren en un renglón
                    <span>
                      Billeteras<span className="hidden sm:inline"> virtuales</span>
                    </span>
                  ) : (
                    f.titulo
                  )}
                  <span
                    className={`hidden sm:inline-flex min-w-6 h-6 px-1.5 items-center justify-center rounded-full text-[15px] tabular-nums ${
                      activo ? "bg-white/20" : "bg-panel text-ink-3"
                    }`}
                  >
                    {f.cantidad}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      <ul key={actual} className="grid grid-cols-1 md:grid-cols-2 tab:grid-cols-3 gap-3 sm:gap-4 list-none">
        {visibles.map((g, idx) => (
          <Tarjeta
            key={g.bancoBilleteraId}
            g={g}
            banco={bancosMap[g.bancoBilleteraId]}
            idx={idx}
            liviano={liviano}
            onAbrir={onAbrir}
            comparacion={comparacionMismoPorcentaje(g, ordenados)}
          />
        ))}
      </ul>
    </section>
  );
};
