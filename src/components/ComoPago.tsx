"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ContactlessPayment, CreditCard, QrCode, type Icon } from "@phosphor-icons/react";
import type { RecursoPago } from "@/logic/formasPago";

/** Las tres formas que le preguntamos a la persona, en el orden en que se muestran. */
export const OPCIONES_COMO_PAGO: { id: RecursoPago; titulo: string; detalle: string; icono: Icon }[] = [
  {
    id: "app",
    titulo: "Con QR o desde la app",
    detalle: "Escaneando el QR con la app del banco, la billetera o MODO",
    icono: QrCode,
  },
  {
    id: "tarjeta",
    titulo: "Con la tarjeta de plástico",
    detalle: "Pasándola o apoyándola en el posnet",
    icono: CreditCard,
  },
  {
    id: "nfc",
    titulo: "Acercando el celular (NFC)",
    detalle: "Solo celulares Android con NFC y la app configurada",
    icono: ContactlessPayment,
  },
];

interface ComoPagoSelectorProps {
  value: RecursoPago[];
  onChange: (recursos: RecursoPago[]) => void;
}

/**
 * "¿Cómo podés pagar?": con eso el motor deja afuera las promos que piden algo que la persona no tiene
 * (ej. un 30% que es solo con NFC en Android), así el porcentaje que ve primero es uno que puede usar.
 */
export const ComoPagoSelector: React.FC<ComoPagoSelectorProps> = ({ value, onChange }) => {
  const toggle = (id: RecursoPago) => onChange(value.includes(id) ? value.filter((r) => r !== id) : [...value, id]);

  return (
    <section aria-labelledby="como-pago-title" className="mb-5">
      <div className="px-2 mb-2">
        <h3 id="como-pago-title" className="text-[17px] font-semibold text-ink">
          ¿Cómo podés pagar?
        </h3>
        <p className="text-base leading-snug text-ink-3">
          Así solo te recomendamos descuentos que podés usar. Marcá todas las que apliquen.
        </p>
      </div>
      <ul className="bg-canvas rounded-3xl overflow-hidden list-none">
        {OPCIONES_COMO_PAGO.map((op, idx) => {
          const activo = value.includes(op.id);
          const Icono = op.icono;
          return (
            <li key={op.id} className="relative">
              {idx > 0 && <div className="absolute top-0 right-0 left-[76px] h-px bg-hairline" aria-hidden="true" />}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => toggle(op.id)}
                aria-pressed={activo}
                className="w-full flex items-center gap-4 pl-4 pr-4 py-3 min-h-[68px] text-left hover:bg-fill/60 active:bg-fill transition-colors duration-200"
              >
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                    activo ? "bg-action-soft text-ink" : "bg-fill text-ink-3"
                  }`}
                  aria-hidden="true"
                >
                  <Icono size={22} weight="bold" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] font-semibold leading-snug text-ink">{op.titulo}</span>
                  <span className="block text-base leading-snug text-ink-3">{op.detalle}</span>
                </span>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                    activo ? "bg-action text-white" : "border-2 border-fill-strong bg-surface"
                  }`}
                  aria-hidden="true"
                >
                  <AnimatePresence initial={false}>
                    {activo && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
                        className="flex"
                      >
                        <Check size={17} weight="bold" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

interface AvisoComoPagoProps {
  /** Mejor porcentaje de las promos de hoy que quedaron afuera por la forma de pago. */
  maxPorcentaje: number;
  cantidad: number;
  /** true si lo que falta marcar es NFC (el caso más común): se ofrece activarlo con un toque. */
  faltaNfc: boolean;
  onTengoNfc: () => void;
  onCambiar: () => void;
}

/**
 * Aviso cuando hoy hay un descuento mejor que pide algo que la persona no marcó (casi siempre NFC en Android).
 * Pregunta en el momento justo, en vez de mostrar un porcentaje que quizás no puede usar.
 */
export const AvisoComoPago: React.FC<AvisoComoPagoProps> = ({ maxPorcentaje, cantidad, faltaNfc, onTengoNfc, onCambiar }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", bounce: 0.18, duration: 0.5, delay: 0.15 }}
    className="tarjeta rounded-3xl mt-4 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
    role="note"
  >
    <span className="flex items-start gap-4 flex-1 min-w-0">
      <span className="aro w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0" aria-hidden="true">
        {faltaNfc ? <ContactlessPayment size={22} weight="bold" /> : <QrCode size={22} weight="bold" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold leading-snug text-ink">
          {faltaNfc ? "¿Tu celular es Android con NFC?" : "Hay descuentos que se pagan de otra forma"}
        </span>
        <span className="block text-base leading-snug text-ink-3">
          {faltaNfc
            ? `Hoy tendrías hasta ${maxPorcentaje}% pagando con el celular (${cantidad === 1 ? "1 promo más" : `${cantidad} promos más`}).`
            : `Hoy hay hasta ${maxPorcentaje}% de reintegro con una forma de pago que no marcaste.`}
        </span>
      </span>
    </span>
    <span className="flex flex-wrap gap-2 sm:shrink-0">
      {faltaNfc && (
        <button
          type="button"
          onClick={onTengoNfc}
          className="min-h-12 px-5 rounded-full bg-action text-white text-base font-semibold shadow-[0_6px_16px_rgb(19_21_23/0.18)] hover:bg-action-strong transition-colors duration-200"
        >
          Sí, tengo NFC
        </button>
      )}
      <button
        type="button"
        onClick={onCambiar}
        className="min-h-12 px-5 rounded-full bg-surface text-base font-semibold text-ink shadow-[0_0_0_1px_var(--color-hairline)] hover:shadow-[0_0_0_1px_var(--color-fill-strong)] transition-shadow duration-200"
      >
        {faltaNfc ? "No, o no sé" : "Cambiar cómo pago"}
      </button>
    </span>
  </motion.div>
);
