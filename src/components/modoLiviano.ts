/**
 * Modo liviano: sin animaciones, sin scroll suavizado, sin desenfoques ni sombras difusas.
 * Se activa solo en equipos que no lo van a mover fluido, o si la persona lo elige.
 */

export type PreferenciaAnimaciones = "auto" | "activadas" | "desactivadas";

export type MotivoLiviano =
  | "sistema" // el sistema pide reducir movimiento
  | "ahorro-datos" // ahorro de datos activado
  | "hardware" // pocos núcleos o poca memoria
  | "sin-aceleracion" // el navegador dibuja por software (aceleración gráfica desactivada)
  | "fps"; // se midió que la página no iba fluida

export const TEXTO_MOTIVO: Record<MotivoLiviano, string> = {
  sistema: "tu sistema pide reducir el movimiento",
  "ahorro-datos": "tenés activado el ahorro de datos",
  hardware: "tu equipo tiene pocos recursos",
  "sin-aceleracion": "la aceleración gráfica está desactivada",
  fps: "la página no iba fluida",
};

const PREF_KEY = "pagamejor_animaciones";
const FPS_KEY = "pagamejor_equipo_lento";
/** Cuánto se recuerda una medición lenta antes de volver a medir. */
const FPS_VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000;
/** Por debajo de estos cuadros por segundo (mediana) se considera que no va fluido. */
export const FPS_MINIMOS = 45;

function leer(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function escribir(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura solo esta visita
  }
}

export function leerPreferencia(): PreferenciaAnimaciones {
  const v = leer(PREF_KEY);
  return v === "activadas" || v === "desactivadas" ? v : "auto";
}

export function guardarPreferencia(p: PreferenciaAnimaciones): void {
  escribir(PREF_KEY, p === "auto" ? null : p);
}

export function guardarLentoPorFps(): void {
  escribir(FPS_KEY, String(Date.now()));
}

function lentoPorFpsReciente(): boolean {
  const fecha = Number(leer(FPS_KEY));
  return Number.isFinite(fecha) && fecha > 0 && Date.now() - fecha < FPS_VIGENCIA_MS;
}

/** true si el navegador dibuja por software o no tiene WebGL (aceleración gráfica desactivada). */
function renderizaPorSoftware(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return true;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

/** Señales que se conocen al instante, antes de mostrar cualquier animación. Solo en el cliente. */
export function detectarMotivoLiviano(): MotivoLiviano | null {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "sistema";
  if (nav.connection?.saveData) return "ahorro-datos";
  if ((nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2) return "hardware";
  if (renderizaPorSoftware()) return "sin-aceleracion";
  if (lentoPorFpsReciente()) return "fps";
  return null;
}

/**
 * Mide los cuadros por segundo reales (mediana) durante `duracionMs`.
 * Devuelve null si la pestaña deja de estar visible, porque ahí el navegador frena los cuadros a propósito.
 */
export function medirFps(duracionMs = 1200): Promise<number | null> {
  return new Promise((resolve) => {
    if (document.visibilityState !== "visible") return resolve(null);
    const tiempos: number[] = [];
    let anterior = 0;
    let inicio = 0;
    let id = 0;

    const cancelar = () => {
      cancelAnimationFrame(id);
      resolve(null);
    };
    document.addEventListener("visibilitychange", cancelar, { once: true });

    const cuadro = (t: number) => {
      if (!inicio) inicio = t;
      if (anterior) tiempos.push(t - anterior);
      anterior = t;
      if (t - inicio < duracionMs) {
        id = requestAnimationFrame(cuadro);
        return;
      }
      document.removeEventListener("visibilitychange", cancelar);
      // Casi sin cuadros en todo el período: el equipo está muy exigido
      if (tiempos.length === 0) return resolve(0);
      tiempos.sort((a, b) => a - b);
      resolve(1000 / tiempos[Math.floor(tiempos.length / 2)]);
    };
    id = requestAnimationFrame(cuadro);
  });
}
