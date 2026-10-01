// Sin dependencias (solo tipos): los tests lo importan directo con Node.

/** Cómo se paga en la caja. */
export type FormaDePago = "NFC" | "QR MODO" | "QR" | "Clave DNI" | "Transferencia" | "Online" | "Tarjeta";

/**
 * Lo que la persona necesita tener para pagar de cada forma. Se lo preguntamos una vez en Mi billetera:
 * - "nfc": un celular Android con NFC, para pagar acercándolo al posnet.
 * - "app": la app del banco o billetera, para pagar con QR, Clave DNI o transferencia.
 * - "tarjeta": la tarjeta de plástico.
 */
export type RecursoPago = "nfc" | "app" | "tarjeta";

export const RECURSOS_PAGO: RecursoPago[] = ["nfc", "app", "tarjeta"];

/**
 * Lo que se asume hasta que la persona lo cambie: app y tarjeta, que tiene casi todo el mundo. NFC queda afuera
 * porque pide un Android con NFC configurado; si hay un descuento mejor con NFC, la pantalla lo avisa y lo ofrece.
 */
export const RECURSOS_POR_DEFECTO: RecursoPago[] = ["app", "tarjeta"];

/** Recurso que pide cada forma. Online no pide nada especial (se compra desde la web o la app del comercio). */
const RECURSO_DE_FORMA: Record<FormaDePago, RecursoPago | null> = {
  NFC: "nfc",
  "QR MODO": "app",
  QR: "app",
  "Clave DNI": "app",
  Transferencia: "app",
  Online: null,
  Tarjeta: "tarjeta",
};

/**
 * Formas de pago de una promo, en orden, leídas de medioPagoDetalle (y de condicionUso como respaldo).
 * Ej. "Visa Crédito vía NFC en app Cuenta DNI (Android)" → ["NFC"]; "QR o Clave DNI" → ["QR", "Clave DNI"].
 * Es determinístico: los mismos textos dan siempre el mismo resultado.
 */
export function formasDePago(medioPagoDetalle: string, condicionUso = ""): FormaDePago[] {
  const m = (medioPagoDetalle || "").toLowerCase();
  const todo = `${m} ${condicionUso.toLowerCase()}`;
  const formas: FormaDePago[] = [];

  if (/tarjeta.*\bo qr\b/.test(m)) formas.push("Tarjeta");
  if (/dinero en cuenta o nfc/.test(m)) formas.push("QR");
  if (/nfc|contactless|sin contacto/.test(m)) formas.push("NFC");
  if (/\bmodo\b/.test(m)) formas.push("QR MODO");
  else if (/\bqr\b/.test(m) && !formas.includes("QR")) formas.push("QR");
  if (/clave dni/.test(m)) formas.push("Clave DNI");
  if (/transferencia/.test(m)) formas.push("Transferencia");
  if (formas.length === 0 && /online|mercado libre|cabify|\bweb\b|checkout/.test(m)) formas.push("Online");
  if (formas.length === 0 && /nfc|contactless/.test(todo)) formas.push("NFC");
  if (formas.length === 0 && /\bqr\b/.test(todo)) formas.push("QR");
  if (formas.length === 0) formas.push("Tarjeta");

  return formas;
}

/**
 * ¿La persona puede pagar esta promo con lo que tiene? Alcanza con una de sus formas (ej. "QR o NFC" sirve a
 * quien no tiene NFC). `recursos` en null significa que todavía no respondió: no se oculta nada.
 */
export function puedePagar(
  promo: { medioPagoDetalle: string; condicionUso?: string },
  recursos: RecursoPago[] | null | undefined
): boolean {
  if (!recursos) return true;
  return formasDePago(promo.medioPagoDetalle, promo.condicionUso).some((forma) => {
    const recurso = RECURSO_DE_FORMA[forma];
    return recurso === null || recursos.includes(recurso);
  });
}
