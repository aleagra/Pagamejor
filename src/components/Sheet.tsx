"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { getLenis } from "@/components/MotionProvider";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Contenido fijo al pie (ej. botón Guardar). */
  footer?: React.ReactNode;
  /** Si es false no se puede cerrar tocando afuera, con Escape, arrastrando ni con "Cerrar" (onboarding). */
  dismissible?: boolean;
  /** Contenido extra fijo bajo el título (ej. buscador). */
  toolbar?: React.ReactNode;
  /**
   * La acción de cerrar va fija abajo (botón ancho "Cerrar") en vez de arriba: para listas largas donde se
   * elige tocando una fila (rubros, otro día). El título y la barra de herramientas quedan fijos arriba.
   */
  cerrarAbajo?: boolean;
  /** "amplio": ventana más ancha en escritorio, para el desglose de un banco. */
  ancho?: "normal" | "amplio";
  children: React.ReactNode;
}

/** Distancia o velocidad de arrastre hacia abajo que cierra el sheet. */
const CIERRE_OFFSET = 110;
const CIERRE_VELOCIDAD = 550;

/**
 * Sheet que sube desde abajo en el celular (con un leve resorte y arrastre para cerrar) y aparece
 * centrado en pantallas grandes. El contenido se asienta un instante después que el contenedor.
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  footer,
  dismissible = true,
  toolbar,
  cerrarAbajo = false,
  ancho = "normal",
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dragControls = useDragControls();

  // Refs para que el efecto dependa solo de isOpen (onClose suele ser una función inline)
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => setMounted(true), []);

  // Pausa el scroll de la página, maneja Escape y devuelve el foco al cerrar
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getLenis()?.stop();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissibleRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      const autofocus = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (autofocus ?? panelRef.current)?.focus({ preventScroll: true });
    }, 60);

    return () => {
      document.body.style.overflow = prevOverflow;
      getLenis()?.start();
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  // El arrastre arranca solo desde el asa o el encabezado (no desde la lista, que tiene su propio scroll)
  const startDrag = (e: React.PointerEvent) => {
    if (!dismissible || window.innerWidth >= 640) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    dragControls.start(e);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CIERRE_OFFSET || info.velocity.y > CIERRE_VELOCIDAD) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" data-lenis-prevent>
          <motion.div
            className="absolute inset-0 bg-[rgb(29_31_35/0.42)] sm:bg-[rgb(29_31_35/0.34)] sm:backdrop-blur-[3px] liviano:bg-[rgb(29_31_35/0.42)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`relative w-full ${ancho === "amplio" ? "sm:max-w-[880px]" : "sm:max-w-xl"} max-h-[92dvh] sm:max-h-[86dvh] flex flex-col bg-surface rounded-t-[28px] sm:rounded-[28px] shadow-[var(--shadow-float)] outline-none overflow-hidden`}
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.2, duration: 0.5 } }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            {/* Asa del sheet (solo celular): se puede arrastrar hacia abajo para cerrar */}
            <div
              className="sm:hidden flex justify-center pt-2.5 pb-1 touch-none cursor-grab"
              onPointerDown={startDrag}
              aria-hidden="true"
            >
              <div className="w-10 h-1.5 rounded-full bg-fill-strong" />
            </div>

            <motion.div
              className="flex flex-col min-h-0 flex-1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.08, type: "spring", bounce: 0.15, duration: 0.5 } }}
            >
              <header
                className="flex items-start justify-between gap-4 px-6 pt-3 sm:pt-6 pb-4 touch-pan-x sm:touch-auto"
                onPointerDown={startDrag}
              >
                <div className="min-w-0">
                  <h2 id={titleId} className="display text-[24px] sm:text-[26px] font-semibold leading-tight text-ink">
                    {title}
                  </h2>
                  {description && (
                    <div className="mt-1 text-base sm:text-[17px] leading-snug text-ink-2">{description}</div>
                  )}
                </div>
                {dismissible && !cerrarAbajo && (
                  <motion.button
                    type="button"
                    onClick={onClose}
                    whileTap={{ scale: 0.94 }}
                    className="shrink-0 min-h-12 px-4 rounded-full bg-fill text-[17px] font-semibold text-ink hover:bg-fill-strong transition-colors duration-200"
                  >
                    Cerrar
                  </motion.button>
                )}
              </header>

              {toolbar && <div className="px-6 pb-4">{toolbar}</div>}

              <div className="scroll-quiet flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-6">
                {children}
              </div>

              {(footer || (cerrarAbajo && dismissible)) && (
                <div className="px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-hairline bg-surface">
                  {footer ?? (
                    <motion.button
                      type="button"
                      onClick={onClose}
                      whileTap={{ scale: 0.98 }}
                      className="w-full min-h-14 px-6 rounded-full bg-fill text-lg font-semibold text-ink hover:bg-fill-strong transition-colors duration-200"
                    >
                      Cerrar
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
