"use client";

import React from "react";
import {
  ArrowsLeftRight,
  ContactlessPayment,
  CreditCard,
  Globe,
  Password,
  QrCode,
  type Icon,
} from "@phosphor-icons/react";
import { type FormaDePago, type MetodoPago } from "@/components/format";

const ICONOS: Record<FormaDePago, Icon> = {
  NFC: ContactlessPayment,
  "QR MODO": QrCode,
  QR: QrCode,
  "Clave DNI": Password,
  Transferencia: ArrowsLeftRight,
  Online: Globe,
  Tarjeta: CreditCard,
};

export function iconoDeForma(forma: FormaDePago | undefined): Icon {
  return (forma && ICONOS[forma]) || CreditCard;
}

interface MetodoPagoLineaProps {
  metodo: MetodoPago;
  className?: string;
}

/** "NFC · Crédito" con el ícono de la forma de pago: se lee sin abrir el detalle. */
export const MetodoPagoLinea: React.FC<MetodoPagoLineaProps> = ({ metodo, className = "" }) => {
  const Icono = iconoDeForma(metodo.formas[0]);
  const conModo = metodo.formas.includes("QR MODO");
  return (
    <span className={`flex items-start gap-1.5 text-base leading-snug text-ink-3 ${className}`}>
      {/* Mismo tono que el resto de los datos secundarios; MODO solo se distingue por el color del ícono */}
      <Icono size={17} weight="bold" className={`shrink-0 mt-[3px] ${conModo ? "text-warn" : ""}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="sr-only">Cómo pagar: </span>
        {metodo.texto}
      </span>
    </span>
  );
};
