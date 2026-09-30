"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BancoBilletera, Promocion } from "@/data/schema";
import { GroupedBankPromo, PromoNivelDescuento, PromoVariante } from "@/logic/types";
import { BankBadge } from "@/components/BankBadge";
import { EASE_OUT } from "@/components/MotionProvider";
import { DescuentoTag } from "@/components/DescuentoTag";
import { DiasChips, InfoItem } from "@/components/InfoItem";
import {
  type MetodoPago as MetodoPagoInfo,
  formatMoneda,
  formatTope,
  metodoPago,
  nombreVariante,
} from "@/components/format";
import { MetodoPagoLinea, iconoDeForma } from "@/components/MetodoPago";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  Coins,
  CreditCard,
  HandTap,
  Stack,
  Timer,
} from "@phosphor-icons/react";

/** Cantidad de comercios visibles por nivel antes de "Mostrar N más". */
const VISIBLES_POR_NIVEL = 5;

interface PromoDetailProps {
  group: GroupedBankPromo;
  banco?: BancoBilletera;
  /** Promos completas por id, para mostrar días, vigencia y niveles de cuenta de cada opción. */
  promosById: Record<string, Promocion>;
  /** false dentro del sheet, que ya muestra el banco en su título. */
  withHeader?: boolean;
}

/** "2026-12-31" → "31/12/2026". */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Ícono de la forma de pago de la opción (NFC, QR, Clave DNI…). */
function IconoMedio({ metodo }: { metodo: MetodoPagoInfo }) {
  const Icon = iconoDeForma(metodo.formas[0]);
  return (
    <span className="w-11 h-11 rounded-full bg-accent-soft flex items-center justify-center shrink-0 text-accent" aria-hidden="true">
      <Icon size={21} weight="bold" />
    </span>
  );
}

function OpcionRow({
  group,
  v,
  promo,
  defaultOpen,
  separator,
  aparicion,
}: {
  group: GroupedBankPromo;
  v: PromoVariante;
  promo?: Promocion;
  defaultOpen: boolean;
  separator: boolean;
  /** Retardo de entrada para las filas que aparecen con "Mostrar más"; sin valor, no se anima. */
  aparicion?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `opcion-${v.id}`;
  const metodo = metodoPago(v.medioPagoDetalle, v.condicionUso, promo?.tipoMedioRequerido);
  const resumen = [formatTope(v.tipoTope, v.montoTope), v.minimoCompra ? `Mínimo ${formatMoneda(v.minimoCompra)}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li
      className="relative"
      initial={aparicion === undefined ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.18, duration: 0.5, delay: aparicion ?? 0 }}
    >
      {separator && <div className="absolute top-0 right-0 left-[60px] h-px bg-hairline" aria-hidden="true" />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-[calc(100%+1.5rem)] -mx-3 flex items-center gap-4 px-3 py-3.5 min-h-[72px] rounded-2xl text-left hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors duration-200"
      >
        <IconoMedio metodo={metodo} />
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-semibold leading-snug text-ink">{nombreVariante(v)}</span>
          {/* Cómo se paga: lo que distingue dos opciones del mismo comercio */}
          <MetodoPagoLinea metodo={metodo} className="mt-0.5" />
          <span className="block text-base leading-snug text-ink-3">{resumen}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.45 }}
          className="shrink-0 w-9 h-9 rounded-full bg-panel flex items-center justify-center text-ink-2"
          aria-hidden="true"
        >
          <CaretDown size={18} weight="bold" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <motion.div
              className="flex flex-col gap-4 pb-5 sm:pl-[60px]"
              initial={{ y: -8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
            >
              <InfoItem icon={HandTap} label="Cómo pagar">
                <span className="font-normal">{v.condicionUso}</span>
              </InfoItem>
              {v.medioPagoDetalle && (
                <InfoItem icon={CreditCard} label="Medio de pago">
                  {v.medioPagoDetalle}
                </InfoItem>
              )}
              {promo && (
                <InfoItem icon={CalendarBlank} label="Días que aplica">
                  <DiasChips diasSemana={promo.diasSemana} />
                </InfoItem>
              )}
              {promo?.vigenciaHasta && (
                <InfoItem icon={Timer} label="Vigencia">
                  Hasta el {fechaCorta(promo.vigenciaHasta)}
                </InfoItem>
              )}
              {promo?.niveles && promo.niveles.length > 0 && (
                <InfoItem icon={Stack} label="Según tu paquete de cuenta">
                  <span className="flex flex-col">
                    {promo.niveles.map((n) => (
                      <span key={n.nivel}>
                        {n.nivel}: <strong className="font-bold">{n.porcentaje}%</strong>
                        {n.montoTope ? ` · tope ${formatMoneda(n.montoTope)}` : ""}
                      </span>
                    ))}
                  </span>
                </InfoItem>
              )}
              {v.montoGastoOptimo && (
                <InfoItem icon={Coins} label="Para aprovechar el tope">
                  Gastá hasta {formatMoneda(v.montoGastoOptimo)} en esta compra
                </InfoItem>
              )}
              {v.aclaraciones && (
                <div className="rounded-2xl bg-panel px-4 py-3.5">
                  <p className="text-base font-semibold text-ink-2 mb-1">A tener en cuenta</p>
                  <p className="text-base leading-relaxed text-ink-3">{v.aclaraciones}</p>
                </div>
              )}
              {v.fuenteUrl && (
                <a
                  href={v.fuenteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-12 self-start px-4 rounded-full bg-panel text-base font-semibold text-ink hover:bg-fill transition-colors duration-200"
                >
                  Ver bases y condiciones
                  <ArrowSquareOut size={17} weight="bold" aria-hidden="true" />
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function NivelSection({
  group,
  nivel,
  promosById,
  unicaOpcion,
  orden,
}: {
  group: GroupedBankPromo;
  nivel: PromoNivelDescuento;
  promosById: Record<string, Promocion>;
  unicaOpcion: boolean;
  /** Posición del nivel, para que las secciones entren en cascada. */
  orden: number;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const items = verTodos ? nivel.items : nivel.items.slice(0, VISIBLES_POR_NIVEL);
  const ocultos = nivel.items.length - items.length;

  return (
    <motion.section
      className="pt-5 border-t border-hairline first-of-type:border-t-0 first-of-type:pt-1"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.05 + Math.min(orden, 3) * 0.08 }}
    >
      <h3 className="flex items-center gap-2.5 flex-wrap mb-1">
        <DescuentoTag porcentaje={nivel.porcentaje} />
        <span className="text-[17px] font-semibold text-ink">de reintegro</span>
        <span className="text-base text-ink-3">· {nivel.items.length === 1 ? "1 opción" : `${nivel.items.length} opciones`}</span>
      </h3>

      <ul className="list-none">
        {items.map((v, idx) => (
          <OpcionRow
            key={v.id}
            group={group}
            v={v}
            promo={promosById[v.id]}
            // La primera opción (la de mayor reintegro) se ve abierta, para quien no toque los acordeones
            defaultOpen={unicaOpcion || (orden === 0 && idx === 0)}
            separator={idx > 0}
            aparicion={idx >= VISIBLES_POR_NIVEL ? Math.min(idx - VISIBLES_POR_NIVEL, 10) * 0.035 : undefined}
          />
        ))}
      </ul>

      {ocultos > 0 && (
        <div className="pt-1">
          <motion.button
            type="button"
            onClick={() => setVerTodos(true)}
            whileTap={{ scale: 0.95 }}
            className="min-h-12 px-4 rounded-full bg-panel text-[17px] font-semibold text-ink hover:bg-fill transition-colors duration-200"
          >
            Mostrar {ocultos} {ocultos === 1 ? "opción más" : "opciones más"}
          </motion.button>
        </div>
      )}
    </motion.section>
  );
}

/** Todas las opciones de un banco para el día, agrupadas por porcentaje; cada comercio se abre a su detalle. */
export const PromoDetail: React.FC<PromoDetailProps> = ({ group, banco, promosById, withHeader = true }) => {
  const variosNiveles = group.niveles.length > 1;

  return (
    <div className="flex flex-col gap-5">
      {withHeader && (
        <header className="flex items-center gap-4 px-1 pb-1">
          <BankBadge banco={banco} size="lg" />
          <div className="min-w-0">
            <h2 className="display text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
              {group.bancoBilleteraNombre}
            </h2>
            <p className="text-base text-ink-3">
              {variosNiveles ? "Hasta " : ""}
              {group.maxPorcentaje}% de reintegro · {group.diasTexto}
            </p>
          </div>
        </header>
      )}

      {group.niveles.map((nivel, i) => (
        <NivelSection
          orden={i}
          key={nivel.porcentaje}
          group={group}
          nivel={nivel}
          promosById={promosById}
          unicaOpcion={group.variantes.length === 1}
        />
      ))}

      <p className="px-1 pt-1 text-base leading-relaxed text-ink-3">
        Tocá cada opción para ver cómo pagar. El reintegro lo acredita cada banco o billetera según sus bases.
      </p>
    </div>
  );
};
