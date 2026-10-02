/**
 * Links a Google Maps para ver dónde queda cada comercio en Mar del Plata. Sirve a la persona para encontrar el
 * local más cercano y, de paso, para verificar que la cadena está en la ciudad.
 * Sin imports de alias: se prueba directo con Node (ver tests/logic/run-tests.js).
 */

const CIUDAD = "Mar del Plata";

/** Lugares genéricos ("comercios adheridos") o que no son un local físico (tiendas online, apps, transporte). */
const NO_ES_UN_LOCAL =
  /adherid|participante|identificad|cercan[ií]a|universidad|online|mercado libre|pedidosya|cabify|moov|rappi|colectivo|transporte|estacionamiento|todos los d[ií]as|ahorro con/i;

/** Restos de la frase promocional que quedan pegados al nombre ("Coto lunes -25%", "YPF sept26", "CHANGO MAS YOY - Oct"). */
function limpiarNombre(nombre: string): string {
  return nombre
    .replace(/\(.*?\)/g, "")
    .replace(/\s+-?\d+\s*%.*$/i, "")
    .replace(/\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b.*$/i, "")
    .replace(/\s+(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\d{2}\b.*$/i, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+(yoy|exclusivo|excl)\b.*$/i, "")
    .replace(/^grupo\s+/i, "")
    .replace(/\s+y\s+\d+\s+m[aá]s$/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
}

/**
 * Comercios de una opción para buscar en el mapa: "YPF, Shell, Axion y Puma" → ["YPF", "Shell", "Axion", "Puma"].
 * Vacío si la opción no es de un comercio con locales (comercios adheridos en general, tiendas online, apps).
 */
export function comerciosEnMapa(nombre: string): string[] {
  if (!nombre || NO_ES_UN_LOCAL.test(nombre)) return [];
  // Frase que quedó sin limpiar ("10% y 6 CSI en Frávega"): el comercio va después del último "en"
  const base = /^-?\d/.test(nombre) && /\sen\s/i.test(nombre)
    ? nombre.split(/\sen\s/i).pop()!.replace(/\s+con\s+.*$/i, "")
    : nombre;
  const partes = limpiarNombre(base)
    .split(/\s*,\s*|\s+y\s+|\s*\/\s*/i)
    .map(limpiarNombre)
    .filter((p) => p.length > 1 && !/^\d/.test(p) && !NO_ES_UN_LOCAL.test(p));
  const vistos = new Set<string>();
  return partes.filter((p) => {
    const clave = p.toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** Búsqueda de Google Maps del comercio en Mar del Plata: muestra todos los locales de la ciudad. */
export function linkMapa(comercio: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${comercio}, ${CIUDAD}`)}`;
}
