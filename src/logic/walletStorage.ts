import { RECURSOS_PAGO, type RecursoPago } from "./formasPago";

const STORAGE_KEY = "pagamejor_wallet";
const RECURSOS_KEY = "pagamejor_como_pago";

/**
 * Obtiene la lista de IDs de bancos seleccionados en localStorage.
 * Seguro contra SSR (ejecución en servidor).
 */
export function getStoredWallet(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Error al leer la billetera de localStorage:", error);
    return [];
  }
}

/**
 * Guarda la lista de bancos seleccionados en localStorage.
 */
export function saveStoredWallet(bankIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const uniqueIds = Array.from(new Set(bankIds));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds));
    // Disparamos evento para que otros componentes en la misma ventana se actualicen
    window.dispatchEvent(new Event("pagamejor_wallet_updated"));
  } catch (error) {
    console.error("Error al guardar la billetera en localStorage:", error);
  }
}

/**
 * Verifica si el usuario ya configuró su billetera al menos una vez.
 */
export function hasConfiguredWallet(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Con qué puede pagar la persona (NFC, app, tarjeta). null si todavía no respondió: en ese caso el motor no
 * oculta nada.
 */
export function getStoredRecursos(): RecursoPago[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RECURSOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((r): r is RecursoPago => RECURSOS_PAGO.includes(r));
  } catch (error) {
    console.warn("Error al leer cómo paga de localStorage:", error);
    return null;
  }
}

/** Guarda con qué puede pagar la persona. */
export function saveStoredRecursos(recursos: RecursoPago[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECURSOS_KEY, JSON.stringify(Array.from(new Set(recursos))));
    window.dispatchEvent(new Event("pagamejor_wallet_updated"));
  } catch (error) {
    console.error("Error al guardar cómo paga en localStorage:", error);
  }
}
