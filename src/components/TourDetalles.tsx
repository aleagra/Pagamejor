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

/**
 * "detalles": ilumina "Ver todos los detalles" en la tarjeta de la mejor opción.
 * "opcion": ya con el desglose abierto, ilumina la primera opción y pide tocarla para ver todo su detalle.
 */
export type PasoTour = "detalles" | "opcion";

interface TourDetallesProps {
  paso: PasoTour | null;
  /** Banco o billetera de la mejor opción y cuántas opciones tiene hoy. */
  banco: string;
  opciones: number;
  /** Paso 1: abre el detalle de la mejor opción (y pasa al paso 2). */
  onVer: () => void;
  /** Termina el tutorial (cerrado en el paso 1, o la opción ya se abrió en el paso 2). */
  onCerrar: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Ubicacion {
  /** Tarjeta pegada abajo a todo el ancho (celular vertical) o flotante junto al elemento. */
  modo: "hoja" | "flotante";
  top?: number;
  bottom?: number;
  left?: number;
  width?: number;
  /** De qué lado del elemento quedó, para la dirección de la entrada. */
  lado: "arriba" | "abajo";
}

const MARGEN = 8;
const SEPARACION = 14;
const BORDE = 16;

const SELECTOR: Record<PasoTour, string> = {
  detalles: "[data-tour=ver-detalles]",
  opcion: "[data-tour=opcion]",
};

/** El elemento visible del paso (hay un botón por diseño, celular y escritorio). */
function buscarObjetivo(paso: PasoTour): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(SELECTOR[paso])].find((x) => x.offsetParent !== null) ?? null;
}

/**
 * Dónde va la explicación según el tamaño de la pantalla y dónde quedó el elemento: nunca lo tapa.
 * - Celular vertical (< 640px): hoja a todo el ancho, abajo; si el elemento cae en esa zona, arriba.
 * - Resto (tablet, celular horizontal, escritorio): al lado del elemento, debajo si entra, si no arriba, y si no
 *   entra en ningún lado (pantallas muy bajas) del lado con más lugar, siempre dentro de la pantalla.
 */
function ubicar(rect: Rect, alto: number, ancho: number, altoTarjeta: number): Ubicacion {
  const libreAbajo = alto - (rect.top + rect.height + MARGEN + SEPARACION) - BORDE;
  const libreArriba = rect.top - MARGEN - SEPARACION - BORDE;

  if (ancho < 640) {
    const tapaAbajo = rect.top + rect.height + MARGEN > alto - altoTarjeta;
    return tapaAbajo && libreArriba > libreAbajo
      ? { modo: "flotante", top: BORDE, left: BORDE, width: ancho - BORDE * 2, lado: "arriba" }
      : { modo: "hoja", lado: "abajo" };
  }

  const width = Math.min(380, ancho - BORDE * 2);
  const left = Math.max(BORDE, Math.min(rect.left + rect.width / 2 - width / 2, ancho - width - BORDE));
  const lado = libreAbajo >= altoTarjeta || libreAbajo >= libreArriba ? "abajo" : "arriba";
  const ideal =
    lado === "abajo" ? rect.top + rect.height + MARGEN + SEPARACION : rect.top - MARGEN - SEPARACION - altoTarjeta;
  const top = Math.max(BORDE, Math.min(ideal, alto - altoTarjeta - BORDE));
  return { modo: "flotante", top, left, width, lado };
}

/**
 * Tutorial de la primera vez, en dos pasos:
 * 1. Oscurece la pantalla e ilumina "Ver todos los detalles": la tarjeta muestra solo el mejor lugar.
 * 2. Ya en el desglose, ilumina la primera opción y pide tocarla: adentro está todo (cómo pagar, días, vigencia,
 *    dónde queda, bases). Este paso no se saltea tocando afuera; Escape lo cierra (junto con el desglose).
 * Una vez visto el primer paso no vuelve a aparecer.
 */
export const TourDetalles: React.FC<TourDetallesProps> = ({ paso, banco, opciones, onVer, onCerrar }) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [pantalla, setPantalla] = useState({ alto: 800, ancho: 1200 });
  const [altoTarjeta, setAltoTarjeta] = useState(200);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const focoRef = useRef<HTMLButtonElement>(null);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const objetivoRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Busca el elemento del paso, lo lleva a la vista y lo sigue cuadro a cuadro: así acompaña la entrada del
  // desglose, el scroll y los cambios de tamaño o de orientación sin desfasarse
  useLayoutEffect(() => {
    setRect(null);
    objetivoRef.current = null;
    if (!paso) return;

    let frame = 0;
    let reintento = 0;
    let cancelado = false;
    const inicio = performance.now();
    // En el paso 2 se espera a que el desglose termine de subir antes de mostrar el foco
    const espera = paso === "opcion" ? 550 : 0;

    const seguir = () => {
      if (cancelado) return;
      // Si el elemento se volvió a montar o se ocultó (cambio de diseño celular/escritorio al girar o achicar la
      // ventana), se busca de nuevo el visible
      if (!objetivoRef.current?.isConnected || objetivoRef.current.offsetParent === null) {
        objetivoRef.current = buscarObjetivo(paso);
      }
      const el = objetivoRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
        setPantalla((prev) =>
          prev.alto === window.innerHeight && prev.ancho === window.innerWidth
            ? prev
            : { alto: window.innerHeight, ancho: window.innerWidth },
        );
      }
      frame = requestAnimationFrame(seguir);
    };

    const preparar = () => {
      if (cancelado) return;
      const el = buscarObjetivo(paso);
      if (!el) {
        // El desglose todavía no está: se reintenta un momento y, si no aparece, se termina sin trabar la pantalla
        if (performance.now() - inicio < 2500) reintento = window.setTimeout(preparar, 50);
        else onCerrar();
        return;
      }
      objetivoRef.current = el;
      const r0 = el.getBoundingClientRect();
      const alto = window.innerHeight;
      if (paso === "detalles") {
        // En el celular la explicación va abajo: el botón se lleva siempre a un tercio de la pantalla
        if (window.innerWidth < 640 || r0.top < 80 || r0.bottom > alto - 220) {
          window.scrollTo({ top: Math.max(0, window.scrollY + r0.top - alto / 3) });
        }
      } else if (r0.top < 0 || r0.bottom > alto) {
        el.scrollIntoView({ block: "center" });
      }
      seguir();
    };

    reintento = window.setTimeout(preparar, espera);
    return () => {
      cancelado = true;
      window.clearTimeout(reintento);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // Alto real de la explicación (cambia con el texto, el ancho y el tamaño de letra del sistema)
  useLayoutEffect(() => {
    const el = tarjetaRef.current;
    if (!el) return;
    const medir = () => setAltoTarjeta(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paso, rect !== null]);

  // Paso 1: sin scroll de fondo. En el paso 2 el scroll ya lo frena el desglose (no se toca, así al cerrar el
  // desglose la página vuelve a quedar como estaba)
  useEffect(() => {
    if (paso !== "detalles") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getLenis()?.stop();
    return () => {
      document.body.style.overflow = prev;
      getLenis()?.start();
    };
  }, [paso]);

  // Escape cierra; el foco va al botón principal (paso 1) o al elemento iluminado (paso 2)
  useEffect(() => {
    if (!paso || !rect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(
      () => (paso === "detalles" ? botonRef : focoRef).current?.focus({ preventScroll: true }),
      80,
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, rect !== null]);

  const cerrar = () => {
    marcarVisto();
    onCerrar();
  };
  const ver = () => {
    marcarVisto();
    onVer();
  };
  // Paso 2: tocar el foco abre la opción de verdad y termina el tutorial
  const abrirOpcion = () => {
    objetivoRef.current?.click();
    onCerrar();
  };

  if (!mounted) return null;

  const ubicacion = rect ? ubicar(rect, pantalla.alto, pantalla.ancho, altoTarjeta) : null;
  const esHoja = ubicacion?.modo === "hoja";

  return createPortal(
    <AnimatePresence>
      {paso && rect && ubicacion && (
        <motion.div
          key={paso}
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3 }}
          data-lenis-prevent
        >
          {/* Fondo: en el paso 1 tocarlo cierra el tutorial; en el paso 2 no hace nada (hay que tocar la opción) */}
          <div className="absolute inset-0" onClick={paso === "detalles" ? cerrar : undefined} aria-hidden="true" />

          {/* Foco de luz sobre el elemento: el oscurecido es la sombra gigante del recuadro */}
          <button
            ref={focoRef}
            type="button"
            onClick={paso === "detalles" ? ver : abrirOpcion}
            tabIndex={paso === "detalles" ? -1 : 0}
            aria-hidden={paso === "detalles" ? true : undefined}
            aria-label={paso === "opcion" ? "Abrir la primera opción para ver todo el detalle" : undefined}
            className={`absolute ring-2 ring-white shadow-[0_0_0_9999px_rgb(19_21_23/0.6)] outline-none focus-visible:ring-4 ${
              paso === "detalles" ? "rounded-full" : "rounded-2xl"
            }`}
            style={{
              top: rect.top - MARGEN,
              left: rect.left - MARGEN,
              width: rect.width + MARGEN * 2,
              height: rect.height + MARGEN * 2,
            }}
          />

          <motion.div
            ref={tarjetaRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={
              esHoja
                ? "fixed inset-x-0 bottom-0 rounded-t-[28px] bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]"
                : "absolute rounded-3xl bg-surface p-5 shadow-[var(--shadow-float)]"
            }
            style={
              esHoja
                ? undefined
                : {
                    top: ubicacion.top,
                    left: ubicacion.left,
                    width: ubicacion.width,
                    // Pantallas muy bajas: la explicación se desplaza adentro antes que salirse de la pantalla
                    maxHeight: pantalla.alto - BORDE * 2,
                    overflowY: "auto",
                  }
            }
            initial={esHoja ? { opacity: 0, y: 40 } : { opacity: 0, y: ubicacion.lado === "abajo" ? -8 : 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5, delay: 0.1 }}
          >
            <p className="text-base font-semibold text-ink-3">Paso {paso === "detalles" ? 1 : 2} de 2</p>
            {paso === "detalles" ? (
              <>
                <p id={titleId} className="display mt-0.5 text-[22px] font-semibold leading-tight text-ink">
                  Hay más lugares con descuento
                </p>
                <p className="mt-1.5 text-[17px] leading-snug text-ink-2">
                  Hoy {banco} tiene {opciones} opciones. Tocá el botón para ver dónde usarlo y cómo pagar en cada una.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    ref={botonRef}
                    type="button"
                    onClick={ver}
                    className="order-2 inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-full bg-action text-white text-base font-semibold hover:bg-action-strong transition-colors duration-200"
                  >
                    Ver detalles
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={cerrar}
                    className="order-1 min-h-12 px-4 rounded-full bg-fill text-base font-semibold text-ink hover:bg-fill-strong transition-colors duration-200"
                  >
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id={titleId} className="display mt-0.5 text-[22px] font-semibold leading-tight text-ink">
                  Tocá una opción para ver todo
                </p>
                <p className="mt-1.5 text-[17px] leading-snug text-ink-2">
                  Cada opción se abre y muestra cómo pagar, qué días aplica, hasta cuándo, dónde queda en el mapa y las
                  bases. Tocá la opción marcada para probar.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
