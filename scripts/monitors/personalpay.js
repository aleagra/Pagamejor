/**
 * Monitor Agent: Extractor y Auditor de Personal Pay
 * Fuente: https://www.personal.com.ar/pay/beneficios
 *
 * La web consume una API JSON pública (la misma que usa su propio buscador), que se consulta directo con fetch:
 *   1. /pay/api/benefits?offset=N   -> listado paginado de a 10 (id, %, días, tipo, niveles)
 *   2. /pay/api/benefits/<id>       -> detalle: descripción, texto legal, vigencia, medios de pago y LOCALES con
 *                                      latitud/longitud (con eso se verifica la presencia en Mar del Plata)
 *
 * Alcance:
 * - Solo descuentos o reintegros porcentuales sobre el TOTAL de la compra. La mayoría de los "descuentos" de
 *   Personal Pay son sobre un producto o combo ("20% en 2 cajitas felices", "30% en Combo Big Mac"): no sirven para
 *   comparar con qué pagar y se ignoran, igual que los 2x1, 3x2 y cupones.
 * - Solo con al menos un local en Mar del Plata (por coordenadas). Las solo online se ignoran.
 * - Niveles: si la promo tiene niveles y ninguno es "Todos los usuarios" (LVL00), es de un segmento y se ignora.
 * - Tope: el que diga el texto (descripción o legal) o el del nivel con su período ("Se renueva los Lunes" =
 *   semanal). Si no se puede determinar, activo:false: nunca se supone un tope.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'personalpay';
const API = 'https://www.personal.com.ar/pay/api/benefits';
const WEB = 'https://www.personal.com.ar/pay/beneficios';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

/** Recuadro de Mar del Plata (sur, oeste, norte, este), el mismo que usa el extractor de MODO. */
const MDP = { sur: -38.15, oeste: -57.75, norte: -37.85, este: -57.48 };
const enMdp = l => {
  const lat = Number(l.lat);
  const lon = Number(l.lon);
  return lat > MDP.sur && lat < MDP.norte && lon > MDP.oeste && lon < MDP.este;
};

/** Sobre el total de la compra (no un producto o combo). */
const TOTAL = /total de la (compra|cuenta)/;

const RUBRO_HEADING = { supermercado: 'supermercado', gastronomia: 'gastronomia', 'fast food': 'gastronomia', combustible: 'combustible' };
const RUBRO_REGLAS = [
  ['supermercado', /supermerc|mayorist|almacen/], ['combustible', /combustible|ypf|shell|axion/],
  ['farmacia', /farmac|perfum|cosmetic|natura|optica/], ['gastronomia', /cafe|cervec|resto|bar\b|burger|pizz/],
  ['indumentaria', /grimoldi|indumentaria|calzado|zapat|deport|topper/], ['hogar', /arredo|hogar|blanqueri|colchon/],
];

const getJson = url => C.fetchJson(url, { headers: HEADERS });

async function enPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]).catch(e => ({ error: e.message }));
    }
  }));
  return out;
}

function rubroDe(d) {
  const h = RUBRO_HEADING[C.norm(d.heading || '')];
  if (h) return { rubro: h, inferido: false };
  const s = C.norm(`${d.title} ${d.heading}`);
  const hit = RUBRO_REGLAS.find(([, re]) => re.test(s));
  return { rubro: hit ? hit[0] : 'otros', inferido: true };
}

/** "$3000000" -> 3000000. */
const monto = s => {
  const n = Number(String(s || '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Período del tope de un nivel: "Se renueva los Lunes" (semanal) o "el primer día de cada mes" (mensual). */
function periodoNivel(renovacion) {
  const r = C.norm(renovacion || '');
  if (/cada mes|mensual/.test(r)) return 'por_mes';
  if (/lunes|semana/.test(r)) return 'por_semana';
  if (/cada dia|diari/.test(r)) return 'por_dia';
  return null;
}

/** Cómo se paga, en palabras, y el tipo de medio para el filtro de "¿Cómo podés pagar?". */
function medioDe(metodos) {
  const n = metodos.map(m => C.norm(m.name || ''));
  const partes = [];
  if (n.some(x => /qr/.test(x))) partes.push('QR desde la app Personal Pay');
  if (n.some(x => /tarjeta visa/.test(x))) partes.push('Tarjeta Visa Personal Pay');
  if (n.some(x => /nfc|sin contacto/.test(x))) partes.push('NFC desde el celular (Android)');
  if (n.some(x => /saldo/.test(x))) partes.push('saldo en cuenta');
  const texto = partes.length ? partes.join(', ').replace(/, ([^,]*)$/, ' o $1') : 'App Personal Pay';
  return { medioPagoDetalle: texto.charAt(0).toUpperCase() + texto.slice(1), tipoMedioRequerido: 'cualquiera' };
}

async function auditarPersonalPay() {
  console.log('[monitor-agent] Consultando la API de beneficios de Personal Pay...');
  const hoy = C.hoyISO();

  const listado = [];
  for (let offset = 0; offset < 1000; offset += 10) {
    const j = await getJson(`${API}?offset=${offset}`);
    const pagina = (j.data && j.data.benefits) || [];
    if (!pagina.length) break;
    listado.push(...pagina);
  }
  const ids = [...new Set(listado.map(b => b.id))];
  console.log(`[monitor-agent] ${ids.length} beneficios en la fuente. Leyendo el detalle de cada uno...`);
  const detalles = await enPool(ids, 6, id => getJson(`${API}/${id}`).then(j => j.data));

  const extraidas = [];
  const ignoradas = [];

  detalles.forEach((d, i) => {
    const id = ids[i];
    if (!d || d.error) { ignoradas.push({ id, motivo: `Error al leer el detalle: ${d && d.error}` }); return; }
    const titulo = (d.title || '').trim();
    const pctM = /(\d{1,3})\s*%/.exec(d.discounts || '');
    if (!pctM) { ignoradas.push({ id, marca: titulo, motivo: `No es un porcentaje ("${d.discounts}")` }); return; }
    const pct = Number(pctM[1]);
    const descripcion = (d.description || '').replace(/\s+/g, ' ').trim();
    const legal = (d.legal || '').replace(/\s+/g, ' ').trim();
    const esReintegro = /reintegro/i.test(d.discounts || '') || d.typeCode === 'Cashback';
    if (!esReintegro && !TOTAL.test(C.norm(`${d.name} ${descripcion}`))) {
      ignoradas.push({ id, marca: titulo, motivo: `Sobre un producto o combo, no el total ("${(d.name || '').trim()}")` });
      return;
    }
    if (/productos seleccionados/i.test(C.norm(`${d.name} ${descripcion}`))) {
      ignoradas.push({ id, marca: titulo, motivo: 'Solo en productos seleccionados' });
      return;
    }
    const niveles = d.levels || [];
    const nivel = niveles.find(l => l.code === 'LVL00') || null;
    if (niveles.length && !nivel) {
      ignoradas.push({ id, marca: titulo, motivo: `Solo para niveles de usuario (${niveles.map(l => l.name).join(', ')})` });
      return;
    }
    const hasta = (d.dueDate || '').slice(0, 10);
    if (!hasta || hasta < hoy) { ignoradas.push({ id, marca: titulo, motivo: `Vencida (${hasta || 'sin fecha'})` }); return; }
    const locales = d.locations || [];
    const localesMdP = locales.filter(enMdp).length;
    if (!localesMdP) {
      ignoradas.push({ id, marca: titulo, motivo: locales.length ? `Sin locales en Mar del Plata (${locales.length} en otras ciudades)` : 'Solo online o sin locales publicados' });
      return;
    }
    if (C.sinPresenciaMdp(titulo) === 'todos') {
      ignoradas.push({ id, marca: titulo, motivo: 'Cadena sin locales en Mar del Plata (SIN_PRESENCIA_MDP)' });
      return;
    }

    const motivos = [];
    const notas = [`Verificado con ${localesMdP} locales en Mar del Plata.`];

    // Tope: manda el texto; si no lo dice, el del nivel con su período
    let tipoTope = null;
    let montoTope = null;
    const topeTexto = C.parseTope(`${descripcion} ${legal}`);
    if (topeTexto && topeTexto.tipoTope) ({ tipoTope, montoTope } = topeTexto);
    else if (nivel && monto(nivel.limitAmount) && periodoNivel(nivel.renewal)) {
      montoTope = monto(nivel.limitAmount);
      tipoTope = periodoNivel(nivel.renewal);
    } else if (topeTexto && topeTexto.montoTope) {
      montoTope = topeTexto.montoTope;
      motivos.push(`Tope de $${montoTope} sin período en el texto; no se asume.`);
    } else {
      motivos.push('La fuente no informa tope ni dice "sin tope"; no verificable.');
    }

    const dias = C.parseDias((d.days || []).join(', ')) || [];
    if (!dias.length) motivos.push('La fuente no indica días.');
    const minimoNivel = nivel && nivel.paymentMin > 100 ? nivel.paymentMin : null;
    const minimo = minimoNivel || C.parseMinimo(`${descripcion} ${legal}`);
    if (nivel && nivel.usageLimit) notas.push(`Se puede usar ${C.norm(nivel.usageLimit)}.`);

    const { medioPagoDetalle, tipoMedioRequerido } = medioDe(d.paymentMethods || []);
    const { rubro, inferido } = rubroDe(d);
    if (inferido) notas.push('Rubro inferido: confirmar.');
    const tipo = esReintegro ? 'reintegro' : 'descuento';

    extraidas.push({
      id: `pp-${C.slugify(titulo)}-${d.id}`,
      bancoBilleteraId: 'personal-pay',
      bancoBilleteraNombre: 'Personal Pay',
      tipoMedioRequerido,
      medioPagoDetalle,
      rubro,
      diasSemana: dias,
      diasTexto: C.diasATexto(dias),
      vigenciaDesde: (d.startDate || '').slice(0, 10) || hoy,
      vigenciaHasta: hasta,
      porcentajeDescuento: pct,
      tipoTope: tipoTope || 'sin_tope',
      montoTope: montoTope || null,
      minimoCompra: minimo || null,
      montoGastoOptimo: C.gastoOptimo(montoTope, pct),
      condicionUso: `Pagar con Personal Pay (${medioPagoDetalle.charAt(0).toLowerCase()}${medioPagoDetalle.slice(1)}).${esReintegro ? ' El reintegro llega a la cuenta de Personal Pay.' : ' El descuento se aplica al pagar.'}`,
      localesAdheridos: titulo,
      aclaraciones: `${pct}% de ${tipo} ${C.diasATexto(dias).toLowerCase()} en ${titulo}.${montoTope ? ` Tope $${montoTope.toLocaleString('es-AR')}${tipoTope === 'por_mes' ? ' por mes' : tipoTope === 'por_semana' ? ' por semana' : tipoTope === 'por_dia' ? ' por día' : ''}.` : tipoTope === 'sin_tope' ? ' Sin tope.' : ''}${minimo ? ` Compra mínima $${minimo.toLocaleString('es-AR')}.` : ''} ${notas.join(' ')}${motivos.length ? ' REVISAR: ' + motivos.join(' ') : ''}`.trim(),
      fuenteUrl: WEB,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
      _meta: { localesMdP, totalLocales: locales.length, nivel: nivel && nivel.code },
    });
  });

  console.log(`[monitor-agent] ${extraidas.length} con locales en Mar del Plata sobre el total de la compra; ${ignoradas.length} ignoradas.`);
  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'Personal Pay',
    bancoIds: ['personal-pay'],
    extraidas,
    ignoradas,
    // Las promos manuales viejas (personal-pay-*) también las audita esta fuente
    filtroCatalogo: p => p.fuenteId === FUENTE_ID || p.bancoBilleteraId === 'personal-pay',
  });
}

auditarPersonalPay().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Personal Pay:', err);
  process.exit(1);
});
