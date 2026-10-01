"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { getLenis } from "@/components/MotionProvider";

const CLAVE_VISTO = "pagamejor_tour_detalles";

/** true si la persona ya vio (o cerró) el tutorial en este dispositivo. */
export function tourDetallesVisto(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTO) !== null;
  } catch {
    return true; // sin almacenamiento no se puede recordar: mejor no insistir en cada visita
  }
}

function marcarVisto() {
  try {
    window.localStorage.setItem(CLAVE_VISTO, "1");
  } catch {
    // modo privado: se vuelve a mostrar en la próxima visita
  }
}

interface TourDetallesProps {
  isOpen: boolean;
  /** Banco o billetera de la mejor opción y cuántas opciones tiene hoy. */
  banco: string;
  opciones: number;
  /** Abre el detalle de la mejor opción (y cierra el tutorial). */
  onVer: () => void;
  onCerrar: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEN = 8;

/**
 * Tutorial de un solo paso, la primera vez: oscurece la pantalla, ilumina "Ver todos los detalles" y explica que
 * adentro están todos los lugares con descuento (la tarjeta muestra solo el mejor). Se puede abrir el detalle
 * desde acá o cerrarlo; en los dos casos no vuelve a aparecer.
 */
export const TourDetalles: React.FC<TourDetallesProps> = ({ isOpen, banco, opciones, onVer, onCerrar }) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Lleva el botón a la vista y sigue su posición (cambios de tamaño de la ventana)
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = document.querySelector<HTMLElement>("[data-tour=ver-detalles]");
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const r0 = el.getBoundingClientRect();
    if (r0.top < 80 || r0.bottom > window.innerHeight - 220) {
      window.scrollTo({ top: window.scrollY + r0.top - window.innerHeight / 3 });
    }
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, { passive: true });
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir);
    };
  }, [isOpen]);

  // Mientras está abierto: sin scroll de fondo, Escape cierra y el foco va al botón principal
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getLenis()?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => botonRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      document.body.style.overflow = prev;
      getLenis()?.start();
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cerrar = () => {
    marcarVisto();
    onCerrar();
  };
  const ver = () => {
    marcarVisto();
    onVer();
  };

  if (!mounted) return null;

  // La explicación va debajo del botón si entra; si no, arriba
  const alto = typeof window === "undefined" ? 800 : window.innerHeight;
  const ancho = typeof window === "undefined" ? 1200 : window.innerWidth;
  const abajo = rect ? rect.top + rect.height + 240 < alto : true;
  const cardWidth = Math.min(360, ancho - 32);
  const cardLeft = rect
    ? Math.max(16, Math.min(rect.left + rect.width / 2 - cardWidth / 2, ancho - cardWidth - 16))
    : 16;

  return createPortal(
    <AnimatePresence>
      {isOpen && rect && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3 }}
          data-lenis-prevent
        >
          {/* Fondo: tocarlo cierra el tutorial */}
          <div className="absolute inset-0" onClick={cerrar} aria-hidden="true" />

          {/* Foco de luz sobre el botón: el oscurecido es la sombra gigante del recuadro */}
          <div
            className="absolute rounded-full pointer-events-none ring-2 ring-white shadow-[0_0_0_9999px_rgb(19_21_23/0.6)]"
            style={{
              top: rect.top - MARGEN,
              left: rect.left - MARGEN,
              width: rect.width + MARGEN * 2,
              height: rect.height + MARGEN * 2,
            }}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute rounded-3xl bg-surface p-5 shadow-[var(--shadow-float)]"
            style={{
              width: cardWidth,
              left: cardLeft,
              ...(abajo ? { top: rect.top + rect.height + MARGEN + 14 } : { bottom: alto - rect.top + MARGEN + 14 }),
            }}
            initial={{ opacity: 0, y: abajo ? -8 : 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5, delay: 0.1 }}
          >
            <p id={titleId} className="display text-[20px] font-semibold leading-tight text-ink">
              Acá están todos los lugares
            </p>
            <p className="mt-2 text-base leading-relaxed text-ink-2">
              La tarjeta muestra el mejor descuento, pero hoy {banco} tiene {opciones} opciones. Tocá{" "}
              <strong className="font-semibold text-ink">Ver todos los detalles</strong> para ver dónde podés usarlo y
              cómo pagar en cada lugar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                ref={botonRef}
                type="button"
                onClick={ver}
                className="inline-flex items-center gap-2 min-h-12 px-5 rounded-full bg-action text-white text-base font-semibold hover:bg-action-strong transition-colors duration-200"
              >
                Ver los detalles
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="min-h-12 px-5 rounded-full bg-fill text-base font-semibold text-ink hover:bg-fill-strong transition-colors duration-200"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
