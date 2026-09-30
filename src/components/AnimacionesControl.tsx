"use client";

import React, { useEffect, useId, useState } from "react";
import { useModoLiviano } from "@/components/MotionProvider";
import { TEXTO_MOTIVO, type PreferenciaAnimaciones } from "@/components/modoLiviano";

const OPCIONES: { valor: PreferenciaAnimaciones; texto: string }[] = [
  { valor: "auto", texto: "Automático" },
  { valor: "activadas", texto: "Siempre" },
  { valor: "desactivadas", texto: "Nunca" },
];

/** Elección de animaciones para cuando la detección automática no acierta. Va en el pie de página. */
export const AnimacionesControl: React.FC = () => {
  const { liviano, motivo, preferencia, setPreferencia } = useModoLiviano();
  const tituloId = useId();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  const estado =
    preferencia === "auto"
      ? liviano && motivo
        ? `Desactivadas en este equipo porque ${TEXTO_MOTIVO[motivo]}.`
        : "Activadas: este equipo las mueve con fluidez."
      : preferencia === "activadas"
        ? "Siempre activadas en este dispositivo."
        : "Siempre desactivadas en este dispositivo: la página va más liviana.";

  return (
    <section aria-labelledby={tituloId} className="flex flex-col gap-2">
      <h2 id={tituloId} className="text-base font-semibold text-ink-2">
        Animaciones
      </h2>
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-fill max-w-md" role="radiogroup" aria-labelledby={tituloId}>
        {OPCIONES.map((o) => {
          const activo = preferencia === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setPreferencia(o.valor)}
              className={`min-h-12 px-2 rounded-xl text-base font-semibold transition-colors duration-200 ${
                activo ? "bg-surface text-ink shadow-[var(--shadow-segment)]" : "text-ink-2 hover:text-ink"
              }`}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
      <p className="text-base text-ink-3" aria-live="polite">
        {estado}
      </p>
    </section>
  );
};
