"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT, entradaInicial } from "@/components/MotionProvider";

interface HeaderProps {
  /** Línea chica sobre el título (ej. "Hoy, martes 29 de septiembre"). */
  eyebrow: string;
  /** Titular (ej. "¿Con qué pago hoy?"). */
  title: string;
  className?: string;
}

/** Título de la página; al cambiar de día sale hacia arriba y el nuevo entra desenfocado. */
export const Header: React.FC<HeaderProps> = ({ eyebrow, title, className = "" }) => {
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
          <p className="text-[17px] sm:text-lg font-medium text-ink-3 mb-1">{eyebrow}</p>
          <h1 className="display text-[32px] sm:text-[40px] font-bold leading-[1.1] text-ink">{title}</h1>
        </motion.div>
      </AnimatePresence>
    </motion.header>
  );
};
