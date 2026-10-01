/**
 * Utilidades compartidas de los extractores del monitor-agent.
 *
 * Principio rector: NUNCA inventar valores. Los parsers devuelven `null` cuando no pueden
 * determinar un dato y el extractor decide (normalmente: activo=false + nota en aclaraciones).
 */
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const REPORTS_DIR = path.join(__dirname, '../../reports');

// ---------------------------------------------------------------- HTTP

async function conReintento(fn, retries = 3) {
  let ultimo;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      if (i < retries) await new Promise(r => setTimeout(r, 700 * i));
    }
  }
  throw ultimo;
}

async function fetchText(url, options = {}) {
  return conReintento(async () => {
    const res = await fetch(url, {
      ...options,
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-AR,es;q=0.9', ...(options.headers || {}) },
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    return res.text();
  });
}

async function fetchJson(url, options = {}) {
  const txt = await fetchText(url, options);
  return JSON.parse(txt);
}

// ---------------------------------------------------------------- Texto / fechas

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, sepiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MES_RE = Object.keys(MESES).join('|');

function sinAcentos(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Minúsculas, sin acentos y con espacios colapsados. Base para todo el parseo por regex. */
function norm(s) {
  return sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const finDeMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Fecha de hoy en Argentina (UTC-3) como YYYY-MM-DD. */
function hoyISO(now = new Date()) {
  return new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Convierte "/Date(1780282800000)/" (.NET) a YYYY-MM-DD hora Argentina. */
function fechaDotNet(str) {
  const m = /\/Date\((-?\d+)\)\//.exec(str || '');
  if (!m) return null;
  return new Date(Number(m[1]) - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Extrae el rango de vigencia de un texto legal / de condiciones.
 * Soporta: "del 1 de septiembre al 29 de diciembre 2026", "desde el 03/08/2026 al 30/09/2026",
 * "entre el 07 y el 30 de septiembre de 2026", "del 1 al 30 de septiembre",
 * "todos los miércoles de septiembre del 2026", "los meses de septiembre y octubre".
 * Devuelve {desde, hasta, tipo} o null si no puede determinarlo.
 */
function parseVigenciaTexto(texto, anioDefault = Number(hoyISO().slice(0, 4))) {
  let t = norm(texto);
  const idx = t.search(/valid[ao]|vigen/);
  if (idx < 0) return null;
  t = t.slice(idx, idx + 700);

  // "del 1 al 30 de septiembre" / "entre el 07 y el 30 de septiembre" -> duplicar el mes en la primera fecha
  t = t.replace(
    new RegExp(`(\\d{1,2})\\s+(?:y|al|a)\\s+(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MES_RE})`, 'g'),
    '$1 de $3 al $2 de $3'
  );

  const fechas = [];
  const re = new RegExp(
    `(\\d{1,2})/(\\d{1,2})/(\\d{4})|(\\d{1,2})\\s+de\\s+(${MES_RE})(?:\\s*,?\\s*(?:de|del)?\\s*(\\d{4}))?`,
    'g'
  );
  let m;
  while ((m = re.exec(t))) {
    if (m[1]) fechas.push({ d: +m[1], m: +m[2], y: +m[3], pos: m.index });
    else fechas.push({ d: +m[4], m: MESES[m[5]], y: m[6] ? +m[6] : null, pos: m.index });
  }

  if (fechas.length >= 2) {
    // El año faltante se toma del siguiente año explícito (o el default)
    for (let i = fechas.length - 1; i >= 0; i--) {
      if (!fechas[i].y) fechas[i].y = (fechas[i + 1] && fechas[i + 1].y) || anioDefault;
    }
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    const desde = iso(primera.y, primera.m, primera.d);
    const hasta = iso(ultima.y, ultima.m, ultima.d);
    if (desde <= hasta) return { desde, hasta, tipo: 'texto-legal' };
  }

  if (fechas.length === 1) {
    const f = fechas[0];
    const y = f.y || anioDefault;
    // "hasta el 30 de septiembre" => solo fin; "desde el 1 de junio" => solo inicio
    const antes = t.slice(Math.max(0, f.pos - 12), f.pos);
    if (/hasta/.test(antes)) return { desde: null, hasta: iso(y, f.m, f.d), tipo: 'texto-legal' };
    return null;
  }

  // Sin fechas puntuales: "mes de septiembre", "meses de septiembre y octubre", "miercoles de septiembre del 2026"
  const mm = new RegExp(`(?:mes(?:es)?\\s+de\\s+|de\\s+)(${MES_RE})(?:\\s+y\\s+(${MES_RE}))?(?:\\s*,?\\s*(?:de|del)\\s+(\\d{4}))?`).exec(t);
  if (mm) {
    const y = mm[3] ? +mm[3] : anioDefault;
    const m1 = MESES[mm[1]];
    const m2 = mm[2] ? MESES[mm[2]] : m1;
    return { desde: iso(y, m1, 1), hasta: iso(y, m2, finDeMes(y, m2)), tipo: 'mes-completo' };
  }
  return null;
}

// ---------------------------------------------------------------- Días

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const DIAS_RE = Object.keys(DIAS).join('|');
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Interpreta textos como "Lunes y martes", "Lunes a viernes", "Sábado y domingo",
 * "Todos los días", "Fines de semana". Devuelve array ordenado de 0..6 o null si no reconoce nada.
 */
function parseDias(texto) {
  const t = norm(texto);
  if (!t) return null;
  if (/todos los dias|toda la semana|todos los/.test(t) && !new RegExp(DIAS_RE).test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/fines? de semana|fin de semana/.test(t)) return [0, 6];
  const set = new Set();
  // Rangos "lunes a viernes" (respetando que la semana argentina corre de lunes a domingo)
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const rango = new RegExp(`(${DIAS_RE})\\s+a\\s+(${DIAS_RE})`, 'g');
  let m;
  let resto = t;
  while ((m = rango.exec(t))) {
    const i = orden.indexOf(DIAS[m[1]]);
    const j = orden.indexOf(DIAS[m[2]]);
    if (i <= j) for (let k = i; k <= j; k++) set.add(orden[k]);
    else for (let k = i; k < orden.length; k++) set.add(orden[k]);
    resto = resto.replace(m[0], ' ');
  }
  const suelto = new RegExp(`(${DIAS_RE})`, 'g');
  while ((m = suelto.exec(resto))) set.add(DIAS[m[1]]);
  if (set.size === 0) return null;
  return [...set].sort((a, b) => a - b);
}

function diasATexto(dias) {
  if (!dias || dias.length === 0) return '';
  if (dias.length === 7) return 'Todos los días';
  const semana = [1, 2, 3, 4, 5, 6, 0];
  const orden = semana.filter(d => dias.includes(d));
  const nombres = orden.map(d => NOMBRES_DIA[d]);
  if (nombres.length === 1) return nombres[0];
  // Días contiguos (lunes->domingo) de a 3 o más: "Lunes a viernes"
  const idx = orden.map(d => semana.indexOf(d));
  const contiguos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguos && nombres.length >= 3) return `${nombres[0]} a ${nombres[nombres.length - 1].toLowerCase()}`;
  const minus = nombres.map((n, i) => (i === 0 ? n : n.toLowerCase()));
  return minus.slice(0, -1).join(', ') + ' y ' + minus[minus.length - 1];
}

// ---------------------------------------------------------------- Topes / mínimos

const num = s => parseInt(String(s).replace(/\./g, '').replace(/,\d+$/, ''), 10);

/**
 * Determina tope a partir de un texto. Devuelve:
 *  { tipoTope, montoTope }           tope confirmado (o 'sin_tope' explícito)
 *  { tipoTope: null, montoTope }     hay monto pero no se reconoce el período -> no asumir
 *  null                              el texto no menciona tope
 */
function parseTope(texto) {
  const t = norm(texto);
  if (!t) return null;
  const m = /tope[^$.]{0,60}?\$\s*([\d.]+)([^.;]{0,60})/.exec(t)
    || /(?:hasta|maximo(?: de)?)\s+\$\s*([\d.]+)\s+(?:de reintegro|de descuento|por)([^.;]{0,50})/.exec(t);
  const sinTope = /sin tope/.exec(t);
  // Si el texto dice "sin tope" ANTES que cualquier monto, manda "sin tope" (los montos posteriores
  // suelen ser ejemplos representativos o topes de otra variante)
  if (sinTope && (!m || sinTope.index < m.index)) return { tipoTope: 'sin_tope', montoTope: null };
  if (m) {
    const monto = num(m[1]);
    const contexto = `${m[2] || ''}`;
    let tipoTope = null;
    if (/por semana|semanal|por semana/.test(contexto)) tipoTope = 'por_semana';
    else if (/por mes|mensual/.test(contexto)) tipoTope = 'por_mes';
    else if (/por (?:dia|lunes|martes|miercoles|jueves|viernes|sabado|domingo)|diario/.test(contexto)) tipoTope = 'por_dia';
    else if (/por (?:compra|viaje|operacion|transaccion|ticket|consumo)/.test(contexto)) tipoTope = 'por_compra';
    // El período también puede ir antes del monto: "tope de descuento semanal: $15.000"
    if (!tipoTope) {
      const antes = t.slice(Math.max(0, m.index), m.index + m[0].indexOf('$'));
      if (/semanal|por semana/.test(antes)) tipoTope = 'por_semana';
      else if (/mensual|por mes/.test(antes)) tipoTope = 'por_mes';
      else if (/diario|por dia/.test(antes)) tipoTope = 'por_dia';
    }
    return { tipoTope, montoTope: monto };
  }
  if (/sin tope/.test(t)) return { tipoTope: 'sin_tope', montoTope: null };
  return null;
}

function parseMinimo(texto) {
  const t = norm(texto);
  const m = /(?:minimo de compra|compra minima|monto minimo)[^$]{0,30}\$\s*([\d.]+)/.exec(t);
  return m ? num(m[1]) : null;
}

// ---------------------------------------------------------------- Alcance geográfico

/**
 * Fuentes que NO informan sucursales por promo (Patagonia, Naranja X, Supervielle): la presencia en
 * Mar del Plata no se puede verificar desde la fuente. Solo se activan comercios de cadenas con presencia
 * nacional conocida (o de MdP verificada en otra fuente, ej. mapa de MODO: Toledo, Makro, DIA, Disco, Vea);
 * todo lo demás queda inactivo para confirmarlo a mano. Criterio del monitor-agent: revisar la lista
 * cuando aparezcan comercios nuevos.
 */
const PRESENCIA_MDP = /carrefour|coto|changomas|masgo|la anonima|cooperativa obrera|disco|jumbo|\bvea\b|toledo|makro|\bdia\b|havanna|juleriaque|naldo|samsung|topper|arredo|farmacity|simplicity|get the look|ypf|shell|axion|mostaza|mcdonald|burger king|fravega|garbarino|cetrogar|megatone|on ?city|compumundo|easy|sodimac|mercado libre|rappi|pedidosya|cabify|cinemark|hoyts/i;

// ---------------------------------------------------------------- Salida

/** Tope óptimo de gasto = tope / porcentaje. Es aritmética derivada, no un supuesto. */
function gastoOptimo(montoTope, porcentaje) {
  return montoTope && porcentaje ? Math.round(montoTope / (porcentaje / 100)) : null;
}

function escribirJson(nombre, data) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const p = path.join(REPORTS_DIR, nombre);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  return p;
}

function leerJson(ruta, defecto = null) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return defecto;
  }
}

module.exports = {
  UA, REPORTS_DIR, MESES, NOMBRES_DIA,
  fetchText, fetchJson, conReintento,
  norm, sinAcentos, slugify, pad, iso, hoyISO, fechaDotNet, finDeMes,
  PRESENCIA_MDP,
  parseVigenciaTexto, parseDias, diasATexto, parseTope, parseMinimo, gastoOptimo,
  escribirJson, leerJson,
};
