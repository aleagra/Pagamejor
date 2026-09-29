"use client";

import React, { useState } from "react";
import { Promocion, BancoBilletera } from "@/data/schema";
import { GroupedBankPromo } from "@/logic/types";
import { ModoAviso } from "@/components/ModoAviso";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Smartphone,
  QrCode,
  Store,
  CheckCircle2,
} from "lucide-react";

interface AlternativePromosListProps {
  groups?: GroupedBankPromo[];
  promos?: Promocion[];
  bancosMap?: Record<string, BancoBilletera>;
}

function formatMoneda(monto: number | null): string {
  if (monto === null || monto === undefined) return "";
  return `$${monto.toLocaleString("es-AR")}`;
}

function formatTope(tipoTope: string, montoTope: number | null): string {
  if (tipoTope === "sin_tope") return "Sin tope";
  const monto = formatMoneda(montoTope);
  switch (tipoTope) {
    case "por_compra":
      return `Tope ${monto} por compra`;
    case "por_dia":
      return `Tope ${monto} por día`;
    case "por_semana":
      return `Tope ${monto} por semana`;
    case "por_mes":
      return `Tope ${monto} por mes`;
    default:
      return `Tope ${monto}`;
  }
}

function getIconForModalidad(etiqueta: string) {
  if (/nfc|contactless/i.test(etiqueta)) {
    return <Smartphone className="shrink-0 text-forest" size={16} />;
  }
  if (/qr|cuenta|transferencia/i.test(etiqueta)) {
    return <QrCode className="shrink-0 text-terracotta" size={16} />;
  }
  return <Store className="shrink-0 text-text-secondary" size={16} />;
}

export const AlternativePromosList: React.FC<AlternativePromosListProps> = ({
  groups,
  promos,
  bancosMap = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasGroups = groups && groups.length > 0;
  const count = hasGroups ? groups.length : (promos?.length || 0);

  if (count === 0) return null;

  return (
    <section className="mt-6 lg:mt-0" aria-label="Otras opciones en tu billetera">
      {/* Botón desplegable visible SOLO en Mobile y Tablet */}
      <div className="block lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex justify-between items-center p-4 sm:p-5 bg-surface border-2 border-border-strong rounded-2xl text-left hover:bg-surface-elevated transition-colors shadow-xs cursor-pointer"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg sm:text-xl font-extrabold text-text-main">
              Ver otras opciones en tu billetera ({count})
            </span>
          </div>

          <div className="text-text-secondary shrink-0">
            {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </button>
      </div>

      {/* Encabezado fijo SOLO en Desktop */}
      <div className="hidden lg:flex items-center justify-between mb-4 pb-2 border-b border-border-subtle">
        <h3 className="text-xl font-extrabold text-text-main">
          Otras opciones para hoy ({count})
        </h3>
        <span className="text-xs font-bold text-forest bg-forest-bg px-2.5 py-1 rounded-full border border-forest-border">
          En tu billetera
        </span>
      </div>

      {/* Contenedor de la lista */}
      <div className={`${isOpen ? "block mt-4" : "hidden"} lg:block lg:mt-0`}>
        <div className="flex flex-col gap-4">
          {hasGroups
            ? groups.map((g, idx) => {
                const banco = bancosMap[g.bancoBilleteraId];
                const niveles = g.niveles || [];
                const hasMultipleNiveles = niveles.length > 1;

                return (
                  <article
                    key={g.bancoBilleteraId}
                    className="bg-surface border-2 border-border-strong rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-3.5 transition-shadow hover:shadow-sm"
                  >
                    {/* Encabezado con entidad y porcentaje */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        {banco && (
                          <div
                            className="w-11 h-11 rounded-lg flex items-center justify-center text-xs font-black tracking-tighter shrink-0 shadow-xs"
                            style={{
                              backgroundColor: banco.colorPrimario,
                              color: banco.colorTexto,
                            }}
                          >
                            {banco.siglas}
                          </div>
                        )}
                        <div>
                          <h4 className="text-lg sm:text-xl font-extrabold text-text-main leading-tight">
                            {g.bancoBilleteraNombre}
                          </h4>
                          <span className="text-xs text-text-muted">
                            Opción alternativa #{idx + 2} {g.totalOpciones > 1 && `· ${g.totalOpciones} opciones`}
                          </span>
                        </div>
                      </div>

                      <div className="bg-surface-elevated border-2 border-border-strong text-text-main text-lg sm:text-xl font-black px-3 py-1 rounded-xl shrink-0">
                        {hasMultipleNiveles ? `Hasta ${g.maxPorcentaje}%` : `${g.maxPorcentaje}%`}
                      </div>
                    </div>

                    {/* Desglose agrupado por porcentaje */}
                    {niveles.length > 0 ? (
                      <div className="flex flex-col gap-2.5 mt-1">
                        <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                          Descuentos por comercio o modalidad:
                        </div>

                        {niveles.map((nivel) => (
                          <div
                            key={nivel.porcentaje}
                            className="bg-surface-elevated border border-border-subtle rounded-xl p-3 sm:p-3.5 flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="bg-forest text-white text-sm sm:text-base font-black px-2.5 py-0.5 rounded-lg shrink-0">
                                {nivel.porcentaje}% de reintegro
                              </span>
                              {nivel.hasSinTope && (
                                <span className="text-xs font-bold text-forest bg-forest-bg px-2 py-0.5 rounded-full border border-forest-border">
                                  ¡Sin tope!
                                </span>
                              )}
                            </div>

                            {/* Comercios adheridos a este porcentaje */}
                            <div className="flex flex-col gap-1.5 pt-1">
                              {nivel.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-2 text-xs sm:text-sm text-text-main"
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {getIconForModalidad(item.etiquetaModalidad)}
                                  </div>
                                  <div>
                                    <strong className="text-text-main">
                                      {item.localesAdheridos || item.etiquetaModalidad}
                                    </strong>
                                    <span className="text-text-secondary ml-1">
                                      ({formatTope(item.tipoTope, item.montoTope)})
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Medio de pago único */
                      <div className="bg-surface-elevated border border-border-subtle rounded-xl p-3.5">
                        <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-0.5">
                          Medio de pago requerido:
                        </div>
                        <div className="text-base font-bold text-terracotta leading-snug">
                          {g.bestPromo.medioPagoDetalle}
                        </div>
                      </div>
                    )}

                    <ModoAviso promo={g.bestPromo} compacto />

                    {/* Instrucciones de pago */}
                    <div className="text-xs sm:text-sm text-text-secondary border-t border-border-subtle pt-3 flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-text-muted" />
                      <div>
                        <strong>Cómo pagar:</strong> {g.bestPromo.condicionUso}
                      </div>
                    </div>
                  </article>
                );
              })
            : /* Fallback si no hay grupos */
              promos?.map((p, idx) => {
                const banco = bancosMap[p.bancoBilleteraId];
                return (
                  <article
                    key={p.id}
                    className="bg-surface border-2 border-border-strong rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-3.5"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        {banco && (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black tracking-tighter shrink-0"
                            style={{
                              backgroundColor: banco.colorPrimario,
                              color: banco.colorTexto,
                            }}
                          >
                            {banco.siglas}
                          </div>
                        )}
                        <div>
                          <h4 className="text-lg font-extrabold text-text-main">{p.bancoBilleteraNombre}</h4>
                          <span className="text-xs text-text-muted">Opción #{idx + 2}</span>
                        </div>
                      </div>
                      <div className="bg-surface-elevated border-2 border-border-strong text-text-main font-black px-3 py-1 rounded-xl">
                        {p.porcentajeDescuento}%
                      </div>
                    </div>
                  </article>
                );
              })}
        </div>
      </div>
    </section>
  );
};
