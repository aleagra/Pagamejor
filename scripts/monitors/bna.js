/**
 * Monitor Agent: Extractor y Auditor de Banco Nación (Semana Nación / MODO BNA+)
 * Fuente: https://semananacion.com.ar (sitio oficial de promos del BNA; es el que enlaza MODO para el banco)
 *
 * La web consume una API JSON pública (Digiventures "activx"), que se consulta directo con fetch:
 *   1. /api/promotions/?bank=bna-semananacion&checkValidity=true   -> todas las promos (%, días, tope, vigencia,
 *      canal, rubro, productos, T&C)
 *   2. /api/brands?clientId=…&select=campaign                       -> campaña de cada marca de la promo
 *   3. /api/points?campaigns=<c1,c2>                                -> comercios adheridos con su dirección
 *
 * Alcance: SOLO promos presenciales, con reintegro %, vigentes este mes y con comercios en Mar del Plata (o de
 * cadenas nacionales con presencia en MdP, ver C.PRESENCIA_MDP).
 * - El campo "status" de la API no sirve (marca "inactive" promos publicadas): la vigencia sale de las fechas.
 * - El tope se toma del texto legal (manda sobre el campo cashbackLimit, que a veces difiere). Si el legal no
 *   dice el período, la promo queda activo:false para verificarla: nunca se supone un tope.
 * - Las promos que MODO también publica (modoSlug) las cubre el extractor de MODO: acá se saltean.
 * - Segmentos (jubilados, sueldo, etc.) no aplican a cualquier titular: se ignoran, como en MODO.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'bna';
const API = 'https://backend.activx.production.digiventures.la/api';
const BANCO = 'bna-semananacion';
const CLIENTE = '644ab05fa2138709cee22597';
const WEB = 'https://semananacion.com.ar/semananacion';

const DIAS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const EN_MDP = /mar del plata|general pueyrredon|batan\b/i;
const SEGMENTO = /jubilad|sueldo|haberes|payroll|plan sueldo|exclusivo cartera|pgr\b/i;
const NO_PUBLICA = /prueba|\btest\b|oculta/i;
/** Títulos que nombran el día en vez del comercio ("Miércoles", "Viernes y Sábados"). */
const TITULO_DIA = /^(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|fin de semana|especial|todos los dias)\b/;

/** "bna-changomas-35dto" -> "Changomas": el comercio cuando la promo no tiene marca asociada. */
function comercioDeNombre(nombre) {
  const s = (nombre || '').replace(/^bna-/, '').replace(/-(landing|modo|buscador|swm|sn|oculta|\d+dto|ontop)\b.*$/, '').replace(/-/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Rubro por categoría de la fuente (value). Sin entrada => inferido por título. */
const RUBRO_CAT = {
  supermercados: 'supermercado', 'mini-mercados': 'supermercado', mayoristas: 'supermercado', alimentos: 'supermercado',
  carnicerias: 'supermercado', combustibles: 'combustible', ypf: 'combustible', shell: 'combustible', axion: 'combustible',
  'puma-energy': 'combustible', gulf: 'combustible', dapsa: 'combustible', farmacias: 'farmacia', perfumerias: 'farmacia',
  opticas: 'farmacia', gastronomia: 'gastronomia', indumentaria: 'indumentaria', 'construccion y hogar': 'hogar',
  veterinarias: 'mascotas', librerias: 'libreria', entretenimiento: 'entretenimiento', transporte: 'transporte',
};

const getJson = url => C.fetchJson(url, { headers: { Accept: 'application/json' } });

function rubroDe(p) {
  for (const c of p.categories || []) if (RUBRO_CAT[C.norm(c.value || '')]) return { rubro: RUBRO_CAT[C.norm(c.value)], inferido: false };
  const s = C.norm(`${p.promotionTitle} ${p.name} ${(p.categories || []).map(c => c.label).join(' ')}`);
  const reglas = [
    ['supermercado', /supermerc|mayorist|almacen|carnic/], ['combustible', /combustible|ypf|shell|axion/],
    ['farmacia', /farmac|perfum|optica/], ['gastronomia', /gastronom|restaur|comida/],
  ];
  const hit = reglas.find(([, re]) => re.test(s));
  return { rubro: hit ? hit[0] : 'otros', inferido: true };
}

async function auditarBNA() {
  console.log('[monitor-agent] Consultando la API de Semana Nación (BNA)...');
  const hoy = C.hoyISO();
  const finVentana = C.hoyISO(new Date(Date.now() + 31 * 86400000));

  const promos = await getJson(`${API}/promotions/?bank=${BANCO}&checkValidity=true`);
  const marcas = await getJson(`${API}/brands?clientId=${CLIENTE}&select=campaign+title+name`);
  const campañaDe = new Map((Array.isArray(marcas) ? marcas : []).map(b => [b._id, b.campaign]));
  const tituloMarca = new Map((Array.isArray(marcas) ? marcas : []).map(b => [b._id, (b.title || '').trim()]));

  const extraidas = [];
  const ignoradas = [];
  const vistas = new Set();

  const candidatas = promos.filter(p => {
    const desde = (p.startDate || '').slice(0, 10);
    const hasta = (p.endDate || '').slice(0, 10);
    const pct = p.incentive && p.incentive.discount && p.incentive.discount.value;
    const titulo = p.promotionTitle || p.name;
    if (p.disabled) return false;
    if (!pct) return false; // solo cuotas u otro beneficio
    if (p.channel === 'online') return false;
    if (!desde || !hasta || hasta < hoy || desde > finVentana) return false;
    if (p.modoSlug) { ignoradas.push({ id: p.name, motivo: `Publicada también en MODO (${p.modoSlug}): la cubre el extractor de MODO` }); return false; }
    if (pct >= 100) { ignoradas.push({ id: p.name, motivo: 'Bonificación total o cupón (100%), no es un reintegro porcentual' }); return false; }
    if (NO_PUBLICA.test(`${p.name} ${titulo}`)) { ignoradas.push({ id: p.name, motivo: 'Promo de prueba u oculta en la web' }); return false; }
    if (SEGMENTO.test(`${p.name} ${titulo}`)) { ignoradas.push({ id: p.name, motivo: `Segmento específico de clientes: no aplica a cualquier titular` }); return false; }
    return true;
  });
  console.log(`[monitor-agent] ${promos.length} promos en la fuente; ${candidatas.length} presenciales, con % y vigentes este mes. Verificando comercios en Mar del Plata...`);

  for (const p of candidatas) {
    // Comercio: las marcas de la promo; si no tiene, el título (salvo que sea un día) o el nombre interno
    const marcasPromo = [...new Set((p.brands || []).map(b => tituloMarca.get(b)).filter(Boolean))];
    const tituloWeb = (p.promotionTitle || '').trim();
    const titulo = marcasPromo.length
      ? (marcasPromo.length > 3 ? `${marcasPromo.slice(0, 3).join(', ')} y ${marcasPromo.length - 3} más` : marcasPromo.join(', '))
      : tituloWeb && !TITULO_DIA.test(C.norm(tituloWeb)) ? tituloWeb : comercioDeNombre(p.name) || tituloWeb;
    const pct = p.incentive.discount.value;
    const dias = (p.activeDays || []).map(d => DIAS[d]).filter(d => d !== undefined).sort();
    const tyc = (p.termsAndConditions || '').replace(/\s+/g, ' ');

    // La misma promo se publica en varias landings (buscador, landing, modo): una sola por %, días y título
    const clave = `${C.norm(titulo)}|${pct}|${dias.join('')}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);

    // Comercios adheridos en Mar del Plata
    const campañas = [...new Set((p.brands || []).map(b => campañaDe.get(b)).filter(Boolean))];
    let localesMdP = 0;
    let totalLocales = 0;
    if (campañas.length) {
      const pts = await getJson(`${API}/points?campaigns=${encodeURIComponent(campañas.join(','))}&select=merchant+contentData`).catch(() => []);
      totalLocales = Array.isArray(pts) ? pts.length : 0;
      localesMdP = (Array.isArray(pts) ? pts : []).filter(x => EN_MDP.test(C.norm((x.contentData && x.contentData.text) || ''))).length;
    }
    const cadena = C.PRESENCIA_MDP.test(C.norm(`${titulo} ${tituloWeb} ${p.name}`));
    if (!localesMdP && !cadena) {
      ignoradas.push({ id: p.name, motivo: totalLocales ? `Sin comercios en Mar del Plata (${totalLocales} en otras ciudades)` : 'La fuente no publica comercios y no es cadena nacional' });
      continue;
    }

    const motivos = [];
    const notas = [];
    if (!localesMdP) notas.push('La fuente no lista locales en Mar del Plata; se asume presencia por ser cadena nacional.');
    else notas.push(`Verificado con ${localesMdP} comercios en Mar del Plata.`);

    // Tope: manda el texto legal
    const topeLegal = C.parseTope(tyc);
    const limite = p.incentive.discount.cashbackLimit;
    let tipoTope = null;
    let montoTope = null;
    if (topeLegal && topeLegal.tipoTope) {
      ({ tipoTope, montoTope } = topeLegal);
      if (limite && montoTope && limite !== montoTope) notas.push(`El legal dice tope $${montoTope}; el resumen de la web dice $${limite}. Se usa el legal.`);
    } else if (limite) {
      montoTope = limite;
      motivos.push(`Tope de $${limite} sin período en el texto legal; no se asume semana ni mes.`);
    } else {
      motivos.push('La fuente no informa tope; no verificable.');
    }
    if (!dias.length) motivos.push('La fuente no indica días.');

    const productos = p.promotionProducts || [];
    const cred = productos.some(x => /credit/.test(x));
    const deb = productos.some(x => /debit/.test(x));
    const tipoMedio = cred && deb ? 'cualquiera' : cred ? 'credito' : deb ? 'debito' : 'cualquiera';
    const medio = `Tarjetas ${cred && deb ? 'de crédito y débito' : cred ? 'de crédito' : 'de débito'} Visa y Mastercard del BNA vía QR MODO desde la app BNA+`;
    const { rubro, inferido } = rubroDe(p);
    if (inferido) notas.push('Rubro inferido: confirmar.');
    const minimo = C.parseMinimo(tyc);

    extraidas.push({
      id: `bna-sn-${C.slugify(p.name)}`,
      bancoBilleteraId: 'banco-nacion',
      bancoBilleteraNombre: 'Banco Nación (BNA)',
      tipoMedioRequerido: tipoMedio,
      medioPagoDetalle: medio,
      rubro,
      diasSemana: dias,
      diasTexto: C.diasATexto(dias),
      vigenciaDesde: (p.startDate || '').slice(0, 10),
      vigenciaHasta: (p.endDate || '').slice(0, 10),
      porcentajeDescuento: pct,
      tipoTope: tipoTope || 'sin_tope',
      montoTope: montoTope || null,
      minimoCompra: minimo,
      montoGastoOptimo: C.gastoOptimo(montoTope, pct),
      condicionUso: 'Pagar en el comercio escaneando el QR con MODO desde la app BNA+ y elegir una tarjeta del BNA.',
      localesAdheridos: titulo,
      aclaraciones: `${pct}% de reintegro ${C.diasATexto(dias).toLowerCase()} en ${titulo}.${montoTope ? ` Tope $${montoTope}${tipoTope === 'por_mes' ? ' por mes' : tipoTope === 'por_semana' ? ' por semana' : ''}.` : ''} ${notas.join(' ')}${motivos.length ? ' REVISAR: ' + motivos.join(' ') : ''}`.trim(),
      fuenteUrl: /^https?:\/\//.test(p.url || '') ? p.url : p.url ? `${WEB}/${p.url}` : WEB,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
      _meta: { localesMdP, totalLocales, campañas, marcas: marcasPromo.length },
    });
  }

  // La misma promo se publica como paquete ("Shell, YPF, Axion y 3 más") y por marca ("YPF Combustibles"), con el
  // mismo %, días y tope: queda el paquete, que ya nombra la marca
  const marcaClave = s => C.norm(s).split(/\s+/)[0];
  const repetida = (p, otra) =>
    otra !== p && otra.rubro === p.rubro && otra.porcentajeDescuento === p.porcentajeDescuento &&
    otra.diasSemana.join() === p.diasSemana.join() && otra.tipoTope === p.tipoTope && otra.montoTope === p.montoTope &&
    otra._meta.marcas > Math.max(1, p._meta.marcas) && C.norm(otra.localesAdheridos).includes(marcaClave(p.localesAdheridos));
  for (const p of [...extraidas]) {
    if (extraidas.some(otra => repetida(p, otra))) {
      extraidas.splice(extraidas.indexOf(p), 1);
      ignoradas.push({ id: p.id, motivo: `Repetida: ya está incluida en un paquete con el mismo %, días y tope` });
    }
  }

  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'Banco Nación (Semana Nación)',
    bancoIds: ['banco-nacion'],
    extraidas,
    ignoradas,
    // Las de MODO (modo-*) las audita el extractor de MODO
    filtroCatalogo: p => p.fuenteId === FUENTE_ID || (!p.fuenteId && p.bancoBilleteraId === 'banco-nacion'),
  });
}

auditarBNA().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Banco Nación:', err);
  process.exit(1);
});
