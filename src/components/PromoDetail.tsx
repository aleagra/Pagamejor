"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
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
  maxPorcentajeDetalle,
  comerciosVariante,
  metodoPago,
  nombreVariante,
} from "@/components/format";
import { MetodoPagoLinea, iconoDeForma } from "@/components/MetodoPago";
import { comerciosEnMapa, linkMapa } from "@/components/mapas";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretDown,
  Coins,
  CreditCard,
  HandTap,
  MapPin,
  Stack,
  Ticket,
  Timer,
} from "@phosphor-icons/react";

/** Comercios de una opción agrupada visibles antes de "Ver los N comercios". */
const LUGARES_VISIBLES = 12;

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

/** "Se puede usar 1 sola vez" / "Se puede usar hasta 3 veces" (límite por persona en toda la vigencia). */
function textoUsos(limite: number): string {
  return limite === 1 ? "Se puede usar 1 sola vez" : `Se puede usar hasta ${limite} veces`;
}

/** Ícono de la forma de pago de la opción (NFC, QR, Clave DNI…). */
function IconoMedio({ metodo }: { metodo: MetodoPagoInfo }) {
  const Icon = iconoDeForma(metodo.formas[0]);
  return (
    <span className="hidden sm:flex w-11 h-11 rounded-full bg-panel items-center justify-center shrink-0 text-ink-2" aria-hidden="true">
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
  tourTarget = false,
}: {
  group: GroupedBankPromo;
  v: PromoVariante;
  promo?: Promocion;
  defaultOpen: boolean;
  separator: boolean;
  /** Retardo de entrada para las filas que aparecen con "Mostrar más"; sin valor, no se anima. */
  aparicion?: number;
  /** Primera opción del desglose: la que señala el tutorial ("tocá una opción para ver todo el detalle"). */
  tourTarget?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Se monta al abrir por primera vez (no se arma el detalle de todas las opciones de entrada)
  const [montado, setMontado] = useState(defaultOpen);
  if (open && !montado) setMontado(true);
  const panelId = `opcion-${v.id}`;
  const metodo = metodoPago(v.medioPagoDetalle, v.condicionUso, promo?.tipoMedioRequerido);
  // Lugares: cada comercio con su búsqueda en Maps (los genéricos, como "comercios adheridos", van sin link). Una
  // opción que junta promos iguales en varios comercios los lista a todos
  const nombres = comerciosVariante(v);
  const agrupada = nombres.length > 1;
  const lugares = agrupada
    ? nombres.map((n) => ({ nombre: n, mapa: comerciosEnMapa(n)[0] ?? null }))
    : comerciosEnMapa(nombres[0]).map((c) => ({ nombre: c, mapa: c as string | null }));
  const [verLugares, setVerLugares] = useState(false);
  const lugaresVisibles = verLugares ? lugares : lugares.slice(0, LUGARES_VISIBLES);
  const resumen = [
    formatTope(v.tipoTope, v.montoTope),
    v.minimoCompra ? `Mínimo ${formatMoneda(v.minimoCompra)}` : "",
    promo?.limiteUsos ? (promo.limiteUsos === 1 ? "1 solo uso" : `${promo.limiteUsos} usos`) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li
      className="relative"
      initial={aparicion === undefined ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.18, duration: 0.5, delay: aparicion ?? 0 }}
    >
      {separator && <div className="absolute top-0 right-0 left-0 sm:left-[60px] h-px bg-hairline" aria-hidden="true" />}
      <button
        type="button"
        data-tour={tourTarget ? "opcion" : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-[calc(100%+1.5rem)] -mx-3 flex items-center gap-4 px-3 py-3 min-h-[68px] rounded-2xl text-left hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors duration-200"
      >
        <IconoMedio metodo={metodo} />
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-semibold leading-snug text-ink">{nombreVariante(v)}</span>
          {/* Cómo se paga: lo que distingue dos opciones del mismo comercio */}
          <MetodoPagoLinea metodo={metodo} className="mt-0.5" />
          <span className="block text-base leading-snug text-ink-3">{resumen}</span>
          {/* Promo de lugares puntuales: se avisa, para que nadie la tome por un descuento de todos lados */}
          {promo?.alcanceLimitado && (
            <span className="block text-base leading-snug text-warn">Solo en algunos lugares puntuales</span>
          )}
        </span>
        <span
          className={`shrink-0 w-9 h-9 rounded-full bg-panel flex items-center justify-center text-ink-2 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <CaretDown size={18} weight="bold" />
        </span>
      </button>

      {/*
       * Acordeón con CSS (grid-template-rows 0fr -> 1fr): lo resuelve el navegador sin JavaScript por cuadro, así va
       * fluido en celulares de gama media. El contenido se monta al abrir por primera vez y queda montado.
       */}
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {montado && (
            <div
              // El detalle va en un recuadro propio, con aire: se distingue de la fila y de la opción siguiente
              className="mb-4 sm:ml-[60px] rounded-2xl bg-canvas shadow-[inset_0_0_0_1px_var(--color-hairline)] p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6"
            >
              {/* Cómo pagar y lo que hay que tener en cuenta ocupan el ancho; los datos cortos van de a dos */}
              <div className="sm:col-span-2">
                <InfoItem icon={HandTap} label="Cómo pagar">
                  <span className="font-normal">{v.condicionUso}</span>
                </InfoItem>
              </div>
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
              {promo?.limiteUsos && (
                <InfoItem icon={Ticket} label="Cuántas veces">
                  {textoUsos(promo.limiteUsos)} en toda la promo
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
                <div className="sm:col-span-2 rounded-2xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)] px-5 py-4">
                  <p className="text-base font-semibold text-ink-2 mb-1.5">A tener en cuenta</p>
                  <p className="text-base leading-relaxed text-ink-3">{v.aclaraciones}</p>
                </div>
              )}
              {/* Dónde queda: búsqueda en Google Maps de cada comercio en Mar del Plata */}
              {lugares.length > 0 && (
                <div className="sm:col-span-2">
                  <InfoItem
                    icon={MapPin}
                    label={agrupada ? `Dónde vale: ${nombres.length} comercios en Mar del Plata` : "Dónde queda en Mar del Plata"}
                  >
                    <span className="flex flex-wrap gap-2 mt-1.5">
                      {lugaresVisibles.map(({ nombre, mapa }) =>
                        mapa ? (
                          <a
                            key={nombre}
                            href={linkMapa(mapa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ver ${mapa} en Mar del Plata en Google Maps (se abre en otra pestaña)`}
                            className="inline-flex items-center gap-2 min-h-12 px-4 rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)] text-base font-semibold text-ink hover:shadow-[inset_0_0_0_1px_var(--color-accent-line)] transition-shadow duration-200"
                          >
                            <MapPin size={17} weight="bold" className="text-accent" aria-hidden="true" />
                            {lugares.length === 1 ? `Ver ${nombre} en el mapa` : nombre}
                            <ArrowSquareOut size={15} weight="bold" className="text-ink-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span
                            key={nombre}
                            className="inline-flex items-center min-h-12 px-4 rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)] text-base font-semibold text-ink"
                          >
                            {nombre}
                          </span>
                        ),
                      )}
                      {lugares.length > LUGARES_VISIBLES && !verLugares && (
                        <button
                          type="button"
                          onClick={() => setVerLugares(true)}
                          className="min-h-12 px-4 rounded-full bg-panel text-base font-semibold text-ink hover:bg-fill transition-colors duration-200"
                        >
                          Ver los {lugares.length} comercios
                        </button>
                      )}
                    </span>
                  </InfoItem>
                </div>
              )}
              {v.fuenteUrl && (
                <a
                  href={v.fuenteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sm:col-span-2 justify-self-start inline-flex items-center gap-2 min-h-12 px-4 rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)] text-base font-semibold text-ink hover:shadow-[inset_0_0_0_1px_var(--color-accent-line)] transition-shadow duration-200"
                >
                  Ver bases y condiciones
                  <ArrowSquareOut size={17} weight="bold" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function NivelSection({
  group,
  nivel,
  promosById,
  orden,
}: {
  group: GroupedBankPromo;
  nivel: PromoNivelDescuento;
  promosById: Record<string, Promocion>;
  /** Posición del nivel, para que las secciones entren en cascada (0 = la primera, donde apunta el tutorial). */
  orden: number;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const items = verTodos ? nivel.items : nivel.items.slice(0, VISIBLES_POR_NIVEL);
  const ocultos = nivel.items.length - items.length;
  const lugaresNivel = nivel.items.reduce((n, v) => n + comerciosVariante(v).length, 0);

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
        {/* Cuenta lugares, no filas: una opción agrupada vale en varios comercios */}
        {lugaresNivel > 1 && <span className="text-base text-ink-3">· {lugaresNivel} lugares</span>}
      </h3>

      <ul className="list-none">
        {items.map((v, idx) => (
          <OpcionRow
            key={v.id}
            group={group}
            v={v}
            promo={promosById[v.id]}
            // Todo arranca plegado: de un vistazo se ven todos los lugares con su medio de pago y tope
            defaultOpen={false}
            separator={idx > 0}
            tourTarget={orden === 0 && idx === 0}
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
              {maxPorcentajeDetalle(group)}% de reintegro · {group.diasTexto}
            </p>
          </div>
        </header>
      )}

      {group.niveles.map((nivel, i) => (
        <NivelSection orden={i} key={nivel.porcentaje} group={group} nivel={nivel} promosById={promosById} />
      ))}

      <p className="px-1 pt-1 text-base leading-relaxed text-ink-3">
        Tocá cada opción para ver cómo pagar. El reintegro lo acredita cada banco o billetera según sus bases.
      </p>
    </div>
  );
};
