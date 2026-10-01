"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarBlank, CaretDown } from "@phosphor-icons/react";
import { EASE_OUT, entradaInicial } from "@/components/MotionProvider";

interface HeaderProps {
  /** Línea chica sobre el título (ej. "Hoy, martes 29 de septiembre"). */
  eyebrow: string;
  /** Titular (ej. "¿Con qué pago hoy?"). */
  title: string;
  /**
   * En el celular la fecha es el botón para elegir otro día (ahorra un renglón y es un patrón conocido);
   * en pantallas más grandes "Ver otro día" es un botón aparte, a la derecha.
   */
  onCambiarDia?: () => void;
  className?: string;
}

/** Título de la página; al cambiar de día sale hacia arriba y el nuevo entra desenfocado. */
export const Header: React.FC<HeaderProps> = ({ eyebrow, title, onCambiarDia, className = "" }) => {
  return (
    <motion.header {...entradaInicial(1)} className={className}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.14 } }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          {onCambiarDia && (
            <button
              type="button"
              onClick={onCambiarDia}
              aria-label={`${eyebrow}. Ver otro día`}
              className="sm:hidden inline-flex items-center gap-1.5 min-h-11 -ml-2 px-2 mb-0.5 rounded-full text-base font-medium text-ink-2 active:bg-fill transition-colors duration-200"
            >
              <CalendarBlank size={18} weight="bold" aria-hidden="true" />
              {eyebrow}
              <CaretDown size={14} weight="bold" className="text-ink-3" aria-hidden="true" />
            </button>
          )}
          <p
            className={`${onCambiarDia ? "hidden sm:block" : ""} text-base sm:text-[17px] font-medium text-ink-3 mb-1 bajo:mb-0.5`}
          >
            {eyebrow}
          </p>
          <h1 className="display text-[32px] sm:text-[44px] bajo:text-[36px] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
            {title}
          </h1>
        </motion.div>
      </AnimatePresence>
    </motion.header>
  );
};
