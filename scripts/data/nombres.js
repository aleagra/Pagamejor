/**
 * Nombre canónico del comercio en `localesAdheridos` (data-agent).
 *
 * Las fuentes escriben el mismo comercio de mil formas ("Coto", "COTO", "Supermercados COTO", "Coto lunes -25%",
 * "Aprovechá 20% de reintegro en Makro con Banco Comafi", "10% y 6 CSI en Juleriaque"). La app muestra este texto
 * como nombre del lugar, lo usa para buscar en Maps y para agrupar opciones: tiene que ser solo el comercio.
 *
 * - Se quita la frase promocional, los porcentajes, los días, los restos de fecha ("sept26", "- Oct") y el banco.
 * - Las cuotas sin interés ("y 6 CSI", "+ 12CSI") salen del nombre: la app compara reintegros, no cuotas. Se
 *   devuelven aparte para dejarlas en `aclaraciones`.
 * - Las cadenas conocidas quedan siempre con la misma grafía (MARCAS).
 * Lo usan apply-extract (en cada actualización) y validate-data (avisa si algo quedó sin normalizar).
 */

const MESES = 'ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
const DIAS = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?';

/** Grafía única de las cadenas conocidas. Se aplica a cada comercio de la lista ("YPF, SHELL Y AXION"). */
const MARCAS = [
  [/^(supermercados? )?coto$/i, 'Coto'],
  [/^(supermercados? )?toledo$/i, 'Toledo'],
  [/^(supermercados? )?(d[ií]a)$/i, 'DIA'],
  [/^(supermercados? )?vea$/i, 'Vea'],
  [/^(supermercados? )?disco$/i, 'Disco'],
  [/^(supermercados? )?jumbo$/i, 'Jumbo'],
  [/^(supermercados? )?la an[oó]nima$/i, 'La Anónima'],
  [/^(supermercados? )?chango ?m[aá]s$/i, 'ChangoMás'],
  [/^(la )?cooperativa obrera$/i, 'Cooperativa Obrera'],
  [/^(grupo )?farmacity$/i, 'Farmacity'],
  [/^simplicity$/i, 'Simplicity'],
  [/^get the look$/i, 'Get The Look'],
  [/^juleriaque$/i, 'Juleriaque'],
  [/^havanna$/i, 'Havanna'],
  [/^ypf$/i, 'YPF'],
  [/^shell$/i, 'Shell'],
  [/^axion( energy)?$/i, 'Axion'],
  [/^m[aá]s ?go$/i, 'MásGO'],
  [/^mc ?donald'?s$/i, "McDonald's"],
  [/^la fonte d.?oro$/i, "La Fonte D'Oro"],
  [/^sao$/i, 'SAO'],
];

/** "10% y 6 CSI", "+ 12CSI", "3 cuotas sin interés" → 6, 12, 3. */
const CUOTAS = /\s*(?:\+|\by\b)?\s*(\d{1,2})\s*(?:csi|cuotas? sin inter[eé]s)\b/i;

function marca(nombre) {
  const t = nombre.trim();
  // "Get the Look Online" → "Get The Look (tienda online)"
  const online = /^(.+?)\s+online$/i.exec(t);
  if (online) return `${marca(online[1])} (tienda online)`;
  const hit = MARCAS.find(([re]) => re.test(t));
  return hit ? hit[1] : t;
}

/** Lo que queda cuando el texto no nombraba ningún comercio ("Aprovechá 30%… pagando con tu Billetera Buepp"). */
const SIN_COMERCIO = /^(aprovech|con\s|pagando|tus?\s|todos los)/i;

/**
 * @returns {{ nombre: string, cuotas: number | null }} el comercio limpio y, si el texto traía cuotas sin interés,
 * cuántas (para dejarlo en aclaraciones).
 */
function nombreCanonico(texto) {
  const original = String(texto || '').replace(/\s+/g, ' ').trim();
  // Textos genéricos ("Marcas de indumentaria adheridas (Zara, …)", "Comercios de cercanía…") quedan como están
  if (/adherid|participantes|identificad/i.test(original)) return { nombre: original, cuotas: null };
  let t = original
    .replace(/^¡\s*|!\s*$/g, '')
    // Frase pegada al rubro sin espacio ("en colectivosPagá con tu tarjeta…", "de reintegroen tus compras")
    .replace(/([a-záéíóúñ])(Pag[aá]|Us[aá]|Compr[aá])\s.*$/u, '$1')
    .replace(/reintegroen\s/i, 'reintegro en ');
  const mc = CUOTAS.exec(t);
  const cuotas = mc ? Number(mc[1]) : null;
  t = t.replace(CUOTAS, '');

  // Frase promocional: "Aprovechá 20% de reintegro en X pagando con…", "-35% los miércoles en X con…"
  if (/\d\s*%|aprovech/i.test(t) && /\sen\s/i.test(t)) {
    t = t.replace(/^.*?\s(?:en|de)\s+(?:la\s+)?(?=[A-ZÁÉÍÓÚÑ0-9])/u, (m) => (/\d\s*%|aprovech/i.test(m) ? '' : m));
  }
  t = t
    .replace(/^-?(hasta\s+)?\d+\s*%\s*(off\s+)?(de\s+(reintegro|descuento|ahorro)\s*)?(adicional\s+)?(en\s+)?/i, '')
    .replace(/\s*(pagando|abonando|con\s+(tu|tus|el|la|banco|cabal|comafi|santander|supervielle|hipotecario|ciudad|icbc|yoy|buepp|bna|naci[oó]n|mastercard|visa|macro|galicia|credicoop|naranja|ual[aá]|brubank|patagonia|tarjetas?)|exclusivo|excl\.?|-\s*excusivo)\b.*$/i, '')
    .replace(new RegExp(`\\s+-?\\d+\\s*%.*$`, 'i'), '')
    .replace(new RegExp(`\\s+(los\\s+)?(${DIAS})\\b.*$`, 'i'), '')
    .replace(new RegExp(`\\s+(${MESES})\\d{2}\\b.*$`, 'i'), '')
    .replace(new RegExp(`\\s+(yoy\\s+)?-\\s*(${MESES})\\b.*$`, 'i'), '')
    .replace(/\s+yoy$/i, '')
    .replace(/\s*\((hiper|market|express|maxi)[^)]*\)/i, '')
    .replace(new RegExp(`\\s+(${MESES})$`, 'i'), '')
    .replace(/^en\s+tus\s+compras\s+en\s+/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
  if (!t || SIN_COMERCIO.test(t)) return { nombre: original, cuotas };
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // Cada comercio de una lista con su grafía de marca: "YPF, SHELL Y AXION" → "YPF, Shell y Axion"
  const partes = t.split(/\s*,\s*|\s+y\s+/i);
  if (partes.length > 1) {
    const ultimo = partes.pop();
    t = `${partes.map(marca).join(', ')} y ${marca(ultimo)}`;
  } else {
    t = marca(t);
  }
  return { nombre: t || String(texto || '').trim(), cuotas };
}

/** Nota para aclaraciones cuando las cuotas salieron del nombre (si la nota no las menciona ya). */
function notaCuotas(cuotas, aclaraciones) {
  if (!cuotas || /cuotas sin inter/i.test(aclaraciones || '')) return null;
  return `Además, ${cuotas} cuotas sin interés.`;
}

module.exports = { nombreCanonico, notaCuotas, MARCAS };
