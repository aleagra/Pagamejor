const STORAGE_KEY = "pagamejor_wallet";

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
