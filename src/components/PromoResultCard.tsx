"use client";

import React from "react";
import { Promocion, BancoBilletera } from "@/data/schema";
import { GroupedBankPromo, PromoNivelDescuento } from "@/logic/types";
import { ModoAviso } from "@/components/ModoAviso";
import {
  Sparkles,
  CreditCard,
  AlertCircle,
  ShoppingBag,
  Smartphone,
  QrCode,
  Store,
  CheckCircle2,
} from "lucide-react";

interface PromoResultCardProps {
  group?: GroupedBankPromo | null;
  promo?: Promocion | null;
  banco?: BancoBilletera;
}

function formatMoneda(monto: number | null): string {
  if (monto === null || monto === undefined) return "";
  return `$${monto.toLocaleString("es-AR")}`;
}

function formatTope(tipoTope: string, montoTope: number | null): string {
  if (tipoTope === "sin_tope") return "Sin tope de reintegro";
  const monto = formatMoneda(montoTope);
  switch (tipoTope) {
    case "por_compra":
      return `Tope de ${monto} por compra`;
    case "por_dia":
      return `Tope de ${monto} por día`;
    case "por_semana":
      return `Tope de ${monto} por semana`;
    case "por_mes":
      return `Tope de ${monto} por mes`;
    default:
      return `Tope: ${monto}`;
  }
}

function getIconForModalidad(etiqueta: string) {
  if (/nfc|contactless/i.test(etiqueta)) {
    return <Smartphone className="shrink-0 text-forest" size={18} />;
  }
  if (/qr|cuenta|transferencia/i.test(etiqueta)) {
    return <QrCode className="shrink-0 text-terracotta" size={18} />;
  }
  return <Store className="shrink-0 text-text-secondary" size={18} />;
}

export const PromoResultCard: React.FC<PromoResultCardProps> = ({
  group,
  promo,
  banco,
}) => {
  const activePromo = group ? group.bestPromo : promo;
  if (!activePromo) return null;

  const bancoNombre = group ? group.bancoBilleteraNombre : activePromo.bancoBilleteraNombre;
  const maxPct = group ? group.maxPorcentaje : activePromo.porcentajeDescuento;
  const niveles = group ? group.niveles : [];
  const hasMultipleNiveles = niveles.length > 1;
  const hasMultipleVariantes = (group?.variantes.length || 0) > 1;

  return (
    <article
      className="bg-surface border-2 border-forest-border rounded-2xl p-6 sm:p-7 shadow-md mb-6 relative overflow-hidden transition-shadow"
      aria-label={`Mejor opción: ${bancoNombre}`}
    >
      {/* Insignia superior destacada */}
      <div className="inline-flex items-center gap-1.5 bg-forest-bg text-forest text-sm sm:text-base font-extrabold px-3.5 py-1.5 rounded-full mb-4 border border-forest-border">
        <Sparkles size={18} />
        <span>MEJOR OPCIÓN HOY</span>
      </div>

      {/* Cabecera de la entidad con su logotipo y porcentaje máximo */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          {banco && (
            <div
              className="w-13 h-13 rounded-xl flex items-center justify-center text-xs font-black tracking-tighter shrink-0 shadow-xs"
              style={{
                backgroundColor: banco.colorPrimario,
                color: banco.colorTexto,
              }}
              aria-hidden="true"
            >
              {banco.siglas}
            </div>
          )}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main leading-tight">
              {bancoNombre}
            </h2>
            <span className="text-sm sm:text-base text-text-muted">
              {group?.diasTexto || activePromo.diasTexto}
            </span>
          </div>
        </div>

        <div className="inline-flex flex-col items-start sm:items-end self-start sm:self-auto">
          <div className="bg-forest text-white text-2xl sm:text-3xl font-black px-4 py-2 rounded-xl shadow-xs">
            {hasMultipleVariantes ? `Hasta ${maxPct}%` : `${maxPct}% de reintegro`}
          </div>
          {hasMultipleVariantes && (
            <span className="text-xs font-semibold text-text-muted mt-1">
              {group?.totalOpciones} opciones agrupadas
            </span>
          )}
        </div>
      </div>

      {/* AGRUPACIÓN POR NIVELES DE DESCUENTO (Sin repetir cards con el mismo %) */}
      {niveles.length > 0 ? (
        <div className="mb-6 flex flex-col gap-4">
          <div className="text-base sm:text-lg font-extrabold text-text-main">
            Descuentos disponibles según comercio o modalidad:
          </div>

          {niveles.map((nivel) => (
            <div
              key={nivel.porcentaje}
              className="bg-surface-elevated border-2 border-border-subtle rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-border-strong transition-all flex flex-col gap-3.5"
            >
              {/* Encabezado del nivel de descuento */}
              <div className="flex flex-wrap justify-between items-center gap-2.5 pb-2.5 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <span className="bg-forest text-white text-xl sm:text-2xl font-black px-3.5 py-1 rounded-xl shadow-xs">
                    {nivel.porcentaje}% de reintegro
                  </span>
                  {nivel.hasSinTope && (
                    <span className="text-xs sm:text-sm font-bold text-forest bg-forest-bg px-2.5 py-1 rounded-full border border-forest-border">
                      ¡Sin tope de reintegro!
                    </span>
                  )}
                </div>

                <span className="text-xs sm:text-sm font-semibold text-text-muted">
                  {nivel.items.length === 1 ? "1 comercio / opción" : `${nivel.items.length} comercios adheridos`}
                </span>
              </div>

              {/* Lista limpia de comercios y modalidades dentro de este porcentaje */}
              <div className="grid grid-cols-1 gap-2.5">
                {nivel.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-surface rounded-xl p-3 sm:p-3.5 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm sm:text-base"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="p-1.5 bg-surface-elevated rounded-lg shrink-0 mt-0.5 sm:mt-0">
                        {getIconForModalidad(item.etiquetaModalidad)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-text-main text-base sm:text-lg leading-snug">
                          {item.localesAdheridos || item.etiquetaModalidad}
                        </div>
                        <div className="text-xs sm:text-sm text-text-secondary mt-0.5">
                          {formatTope(item.tipoTope, item.montoTope)}
                          {item.montoGastoOptimo && (
                            <span className="text-text-muted"> · Óptimo: {formatMoneda(item.montoGastoOptimo)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.minimoCompra && (
                      <div className="text-xs font-semibold text-terracotta bg-terracotta-bg px-2.5 py-1 rounded-md shrink-0 self-start sm:self-auto border border-terracotta-border">
                        Mínimo: {formatMoneda(item.minimoCompra)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Detalle del medio requerido para este nivel */}
              {nivel.mediosResumen && (
                <div className="text-xs sm:text-sm text-text-secondary flex items-center gap-1.5 pt-1">
                  <CheckCircle2 size={16} className="text-forest shrink-0" />
                  <span>
                    <strong>Medio de pago:</strong> {nivel.mediosResumen}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Caso sin niveles (promo única clásica) */
        <div className="bg-surface-elevated border-2 border-border-subtle rounded-xl p-4 sm:p-5 mb-5">
          <div className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-1">
            Medio de pago a utilizar:
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-terracotta leading-snug">
            {activePromo.medioPagoDetalle}
          </div>
        </div>
      )}

      {/* Aviso: promos que requieren pagar con MODO (asociado a otra tarjeta) */}
      <div className="mb-5 empty:hidden">
        <ModoAviso promo={activePromo} />
      </div>

      {/* Detalles generales e instrucciones */}
      <div className="flex flex-col gap-3.5 text-base sm:text-lg text-text-secondary border-t border-border-subtle pt-5">
        <div className="flex items-start gap-3 leading-relaxed">
          <AlertCircle className="shrink-0 text-text-secondary mt-0.5" size={22} />
          <div>
            <strong className="text-text-main">Cómo pagar:</strong> {activePromo.condicionUso}
          </div>
        </div>
      </div>

      {/* Aclaraciones */}
      {activePromo.aclaraciones && (
        <p className="text-sm text-text-muted mt-4 italic border-t border-border-subtle pt-3">
          * {activePromo.aclaraciones}
        </p>
      )}
    </article>
  );
};
