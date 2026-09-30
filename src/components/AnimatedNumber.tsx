"use client";

import React, { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform, motion } from "motion/react";
import { EASE_OUT, useModoLiviano } from "@/components/MotionProvider";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Sufijo fijo (ej. "%"), que no se anima. */
  suffix?: string;
}

/**
 * Número que sube hasta su valor cuando entra en pantalla (0.8s, termina suave y exacto).
 * El valor final va en aria-label para que el lector de pantalla no lea los intermedios.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className, suffix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const { liviano } = useModoLiviano();
  const mv = useMotionValue(0);
  const texto = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (liviano) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, { duration: 0.8, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, value, mv, liviano]);

  return (
    <span ref={ref} className={className} aria-label={`${value}${suffix}`}>
      <motion.span aria-hidden="true">{texto}</motion.span>
    </span>
  );
};
