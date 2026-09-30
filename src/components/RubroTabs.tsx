"use client";

import React from "react";
import { motion } from "motion/react";
import { DotsThreeCircle } from "@phosphor-icons/react";
import { Rubro, RubroId } from "@/data/schema";
import { RUBRO_CORTO, RUBROS_FRECUENTES, RubroIcon } from "@/components/RubroIcon";
import { useModoLiviano } from "@/components/MotionProvider";

interface RubroTabsProps {
  rubros: Rubro[];
  selectedRubro: RubroId;
  onSelectRubro: (rubroId: RubroId) => void;
  onOpenAllRubros: () => void;
  /** "barra": selector de vidrio en la barra de escritorio. "pagina": botones con ícono arriba (celular). */
  variante: "barra" | "pagina";
}

/**
 * Los tres rubros del día a día (súper, gastronomía, combustible) a un toque, más "Más" con el catálogo
 * completo. Si el rubro elegido no es de los frecuentes, el cuarto botón pasa a mostrarlo.
 */
export const RubroTabs: React.FC<RubroTabsProps> = ({
  rubros,
  selectedRubro,
  onSelectRubro,
  onOpenAllRubros,
  variante,
}) => {
  const { liviano } = useModoLiviano();
  const frecuentes = RUBROS_FRECUENTES.map((id) => rubros.find((r) => r.id === id)).filter(
    (r): r is Rubro => r !== undefined
  );
  const otroElegido = frecuentes.some((r) => r.id === selectedRubro)
    ? null
    : (rubros.find((r) => r.id === selectedRubro) ?? null);
  const enBarra = variante === "barra";
  // Un layoutId distinto por variante: las dos pueden estar montadas a la vez (una oculta por CSS)
  const layoutId = liviano ? undefined : `rubro-activo-${variante}`;

  const indicador = (
    <motion.span
      layoutId={layoutId}
      className={`absolute inset-0 ${enBarra ? "rounded-full" : "rounded-2xl"} bg-surface shadow-[var(--shadow-segment)]`}
      transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
      aria-hidden="true"
    />
  );

  const claseBoton = (activo: boolean) =>
    enBarra
      ? `relative inline-flex items-center gap-2 min-h-12 px-4 rounded-full text-[17px] font-semibold whitespace-nowrap transition-colors duration-200 ${
          activo ? "text-ink" : "text-ink-2 hover:text-ink"
        }`
      : `relative flex flex-col items-center justify-center gap-1 min-h-[68px] px-1 rounded-2xl text-base font-semibold transition-colors duration-200 ${
          activo ? "text-ink" : "text-ink-2"
        }`;

  const contenido = (id: RubroId, nombre: string, activo: boolean) => (
    <>
      {activo && indicador}
      <RubroIcon
        rubro={id}
        size={enBarra ? 20 : 24}
        weight={activo ? "fill" : "regular"}
        className={`relative ${activo ? "text-accent" : ""}`}
      />
      {enBarra ? (
        // En laptops chicas no entran los nombres completos: van los cortos hasta 1280px
        <span className="relative">
          <span className="xl:hidden">{RUBRO_CORTO[id]}</span>
          <span className="hidden xl:inline">{nombre}</span>
        </span>
      ) : (
        <span className="relative truncate max-w-full">{RUBRO_CORTO[id]}</span>
      )}
    </>
  );

  return (
    <div
      role="radiogroup"
      aria-label="Rubro de la compra"
      className={
        enBarra
          ? "flex items-center gap-0.5 p-1 rounded-full bg-black/[0.05] liviano:bg-fill"
          : "grid grid-cols-4 gap-1 p-1 rounded-[20px] bg-fill"
      }
    >
      {frecuentes.map((r) => {
        const activo = r.id === selectedRubro;
        return (
          <motion.button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={activo}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectRubro(r.id)}
            className={claseBoton(activo)}
          >
            {contenido(r.id, r.nombre, activo)}
          </motion.button>
        );
      })}

      {/* Cuarto botón: "Más" o el rubro elegido del catálogo; siempre abre el catálogo completo */}
      <motion.button
        type="button"
        role="radio"
        aria-checked={otroElegido !== null}
        aria-label={otroElegido ? `${otroElegido.nombre}. Tocar para elegir otro rubro.` : "Más rubros"}
        whileTap={{ scale: 0.95 }}
        onClick={onOpenAllRubros}
        className={claseBoton(otroElegido !== null)}
      >
        {otroElegido ? (
          contenido(otroElegido.id, otroElegido.nombre, true)
        ) : (
          <>
            <DotsThreeCircle size={enBarra ? 20 : 24} className="relative" aria-hidden="true" />
            <span className="relative">Más</span>
          </>
        )}
      </motion.button>
    </div>
  );
};
