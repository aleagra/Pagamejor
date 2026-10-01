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

/**
 * Ya no hay control manual en la página: solo se respeta "desactivadas". Un "activadas" guardado por el control viejo
 * se borra, porque anulaba la detección automática sin forma de volver atrás.
 */
export function leerPreferencia(): PreferenciaAnimaciones {
  const v = leer(PREF_KEY);
  if (v === "activadas") escribir(PREF_KEY, null);
  return v === "desactivadas" ? v : "auto";
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

/**
 * true si el navegador dibuja por software o no tiene WebGL (aceleración gráfica desactivada).
 * `failIfMajorPerformanceCaveat` hace que el navegador rechace el contexto cuando solo podría dibujar por software:
 * es la señal más confiable (Chrome con "Usar aceleración gráfica" apagado). El nombre del renderizador es el respaldo.
 */
function renderizaPorSoftware(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const conAceleracion = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null;
    if (!conAceleracion) return true;
    const info = conAceleracion.getExtension("WEBGL_debug_renderer_info");
    const renderer = [conAceleracion.getParameter(conAceleracion.RENDERER), info && conAceleracion.getParameter(info.UNMASKED_RENDERER_WEBGL)]
      .filter(Boolean)
      .join(" ");
    conAceleracion.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer);
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
 * Mide los cuadros mientras la persona usa la página (al tocar algo se abren acordeones y hojas): devuelve el
 * percentil 90 del tiempo entre cuadros, en ms. Por encima de ~40ms (menos de 25 fps en los peores cuadros) la
 * animación se ve trabada aunque la página quieta vaya a 60.
 */
export function medirCuadrosEnUso(duracionMs = 700): Promise<number | null> {
  return new Promise((resolve) => {
    if (document.visibilityState !== "visible") return resolve(null);
    const tiempos: number[] = [];
    let anterior = 0;
    let inicio = 0;
    const cuadro = (t: number) => {
      if (!inicio) inicio = t;
      if (anterior) tiempos.push(t - anterior);
      anterior = t;
      if (t - inicio < duracionMs) return void requestAnimationFrame(cuadro);
      if (tiempos.length < 5) return resolve(null);
      tiempos.sort((a, b) => a - b);
      resolve(tiempos[Math.floor(tiempos.length * 0.9)]);
    };
    requestAnimationFrame(cuadro);
  });
}

/** Percentil 90 de cuadro (ms) a partir del cual una interacción cuenta como trabada. */
export const CUADRO_TRABADO_MS = 40;

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
