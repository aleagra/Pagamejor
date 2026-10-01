"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig, cancelFrame, frame, type FrameData } from "motion/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  FPS_MINIMOS,
  type MotivoLiviano,
  type PreferenciaAnimaciones,
  detectarMotivoLiviano,
  guardarLentoPorFps,
  guardarPreferencia,
  leerPreferencia,
  medirCuadrosEnUso,
  CUADRO_TRABADO_MS,
  medirFps,
} from "@/components/modoLiviano";

/** Instancia compartida para que los sheets puedan pausar el scroll de la página. */
let lenis: Lenis | null = null;
export const getLenis = () => lenis;

/** Curva de salida suave usada en entradas y contadores. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Entrada de la primera carga: cada bloque sube un poco, en cascada. */
export const entradaInicial = (orden: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: EASE_OUT, delay: 0.05 + orden * 0.07 },
});

interface ModoLivianoContext {
  /** true: sin animaciones, sin Lenis, sin desenfoques ni sombras difusas. */
  liviano: boolean;
  /** Por qué se activó solo (null si no se activó automáticamente). */
  motivo: MotivoLiviano | null;
  preferencia: PreferenciaAnimaciones;
  setPreferencia: (p: PreferenciaAnimaciones) => void;
}

const LivianoContext = createContext<ModoLivianoContext>({
  liviano: false,
  motivo: null,
  preferencia: "auto",
  setPreferencia: () => {},
});

export const useModoLiviano = () => useContext(LivianoContext);

const enCliente = typeof window !== "undefined";

/**
 * true si el evento viene de una rueda de mouse con muescas (se suaviza con Lenis) y false si viene de un
 * trackpad o Magic Mouse, que ya tienen inercia propia (se deja nativo). La rueda siempre informa
 * `wheelDeltaY` en múltiplos de 120; en Firefox, que no lo tiene, la rueda scrollea por líneas (deltaMode 1).
 */
export function esRuedaDeMouse(e: WheelEvent): boolean {
  const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
  if (typeof legacy === "number" && legacy !== 0) return legacy % 120 === 0;
  return e.deltaMode === WheelEvent.DOM_DELTA_LINE;
}

/**
 * Scroll con inercia (Lenis) para la página. `lerp` 0.3 llega al 95% del destino en ~160ms,
 * lo mismo que el scroll suave nativo, sin sumar demora. Solo se suaviza la rueda del mouse: el trackpad ya
 * trae su propia inercia y va nativo. Avanza en el mismo cuadro que Motion, un solo bucle de animación.
 */
export function crearScrollSuave(elementos?: { wrapper: HTMLElement; content: HTMLElement }) {
  const instancia = new Lenis({
    ...elementos,
    autoRaf: false,
    lerp: 0.3,
    wheelMultiplier: 1,
    smoothWheel: true,
    syncTouch: false,
    stopInertiaOnNavigate: true,
    virtualScroll: ({ event }) => !(event instanceof WheelEvent) || esRuedaDeMouse(event),
  });
  const update = (data: FrameData) => instancia.raf(data.timestamp);
  frame.update(update, true);
  return {
    instancia,
    destruir: () => {
      cancelFrame(update);
      instancia.destroy();
    },
  };
}

/**
 * Movimiento con presencia pero pensado para uso diario: springs con un rebote leve y scroll con inercia
 * (Lenis) solo con rueda/trackpad. En equipos que no lo moverían fluido (o si la persona lo pide) pasa a
 * modo liviano: sin animaciones, sin Lenis y sin efectos caros de dibujar (ver modoLiviano.ts).
 */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Se calcula al hidratar, antes de que los hijos arranquen sus animaciones de entrada.
  // No cambia el HTML, así que no genera diferencias con lo que renderizó el servidor.
  const [preferencia, setPreferenciaState] = useState<PreferenciaAnimaciones>(() =>
    enCliente ? leerPreferencia() : "auto"
  );
  const [motivo, setMotivo] = useState<MotivoLiviano | null>(() => (enCliente ? detectarMotivoLiviano() : null));
  const liviano = preferencia === "desactivadas" || (preferencia === "auto" && motivo !== null);

  const setPreferencia = (p: PreferenciaAnimaciones) => {
    guardarPreferencia(p);
    setPreferenciaState(p);
  };

  // Atributo en <html> para los estilos del modo liviano (globals.css)
  useEffect(() => {
    document.documentElement.toggleAttribute("data-liviano", liviano);
  }, [liviano]);

  // Si no hubo señales claras, se mide cómo va la página de verdad mientras hace sus entradas
  useEffect(() => {
    if (preferencia !== "auto" || motivo !== null) return;
    let cancelado = false;
    const t = window.setTimeout(async () => {
      const fps = await medirFps();
      if (cancelado || fps === null || fps >= FPS_MINIMOS) return;
      guardarLentoPorFps();
      setMotivo("fps");
    }, 500);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
    // Se mide una sola vez por carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vigía en uso: al tocar algo (abrir un acordeón, una hoja) se miden los cuadros. Si 2 de las últimas 3
  // interacciones se trabaron, el equipo no aguanta las animaciones aunque la página quieta vaya a 60 fps
  useEffect(() => {
    if (liviano) return;
    let midiendo = false;
    const ultimas: boolean[] = [];
    const alTocar = async () => {
      if (midiendo) return;
      midiendo = true;
      const p90 = await medirCuadrosEnUso();
      midiendo = false;
      if (p90 === null) return;
      ultimas.push(p90 > CUADRO_TRABADO_MS);
      if (ultimas.length > 3) ultimas.shift();
      if (ultimas.filter(Boolean).length >= 2) {
        guardarLentoPorFps();
        setMotivo("fps");
      }
    };
    window.addEventListener("pointerup", alTocar, { passive: true });
    return () => window.removeEventListener("pointerup", alTocar);
  }, [liviano]);

  // Scroll con inercia de la página (el único scroll de la app, salvo el interior de los modales),
  // solo si el equipo lo aguanta
  useEffect(() => {
    if (liviano) return;
    const scroll = crearScrollSuave();
    lenis = scroll.instancia;
    return () => {
      scroll.destruir();
      lenis = null;
    };
  }, [liviano]);

  return (
    <LivianoContext.Provider value={{ liviano, motivo, preferencia, setPreferencia }}>
      <MotionConfig
        skipAnimations={liviano}
        reducedMotion="user"
        transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
      >
        {children}
      </MotionConfig>
    </LivianoContext.Provider>
  );
};
