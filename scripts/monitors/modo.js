/**
 * Monitor Agent: Extractor y Auditor de MODO
 * Fuente: https://www.modo.com.ar/promos
 *
 * MODO renderiza con JS, pero la web consume una API JSON pública que se consulta directo con fetch
 * (más estable y rápido que Playwright):
 *   0. /promos/api/rewards/slots-container/<id>        -> secciones (slots) que publica la web hoy
 *      /promos/api/rewards/banks                       -> bancos con su id, para filtrar por banco
 *   1. /promos/api/rewards/slots?slots=<slot>&banks=<id> -> listado de cards (estado, promo_id, flujo).
 *      Sin filtro cada sección muestra una parte; filtrando por banco aparecen promos que no salen sin filtro,
 *      así que se recorren todas las secciones sin filtro y filtradas por cada banco de la billetera.
 *   2. promoshub.../map/stores?application_id&zone=    -> locales adheridos en Mar del Plata
 *   3. /promos/api/rewards/v2/benefit/<slug>           -> % , tope + período, mínimo, cronograma, T&C
 *   4. /promos/api/rewards/v2/benefit/<slug>/banks     -> bancos habilitados
 *
 * Alcance: SOLO promos vigentes, con reintegro %, presenciales y con locales en Mar del Plata.
 * Nunca se supone un tope: si no se puede confirmar => activo:false + nota.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');
const fs = require('fs');
const path = require('path');

const FUENTE_ID = 'modo';
const API = 'https://www.modo.com.ar/promos/api/rewards';
const MAP_API = 'https://promoshub.modo.com.ar/promos/api/map/stores';
const ZONA_MDP = '-57.75,-38.15,-57.45,-37.90'; // oeste,sur,este,norte
const ZONA_PAIS = '-73,-55,-53,-22';
const CONTENEDOR_SLOTS = 'web-modo-container-hub-promos-1';
/** Respaldo si la API de secciones no responde (las 6 publicadas al 30/09/2026). */
const SLOTS_RESPALDO = [
  'web-modo-hub-carrousel_principal',
  'web-modo-hub-destacadas',
  'web-modo-hub-supermercados',
  'web-modo-hub-exclusivas-online',
  'web-modo-hub-promos-financiacion',
  'web-modo-hub-mas-promos',
];

const BANCOS = {
  nacion: ['banco-nacion', 'Banco Nación (BNA)'], galicia: ['galicia', 'Banco Galicia'],
  bbva: ['bbva', 'Banco BBVA'], santander: ['santander', 'Banco Santander'],
  macro: ['banco-macro', 'Banco Macro'], icbc: ['icbc', 'Banco ICBC'],
  credicoop: ['banco-credicoop', 'Banco Credicoop'], comafi: ['banco-comafi', 'Banco Comafi'],
  ciudad: ['banco-ciudad', 'Banco Ciudad'], supervielle: ['supervielle', 'Banco Supervielle'],
  hipotecario: ['banco-hipotecario', 'Banco Hipotecario'],
  yoy: ['yoy', 'YOY'], // YOY (cuenta digital de ICBC) es un medio propio en la billetera
  buepp: ['banco-ciudad', 'Banco Ciudad'], // Buepp es la billetera de Banco Ciudad
  corrientes: ['banco-corrientes', 'Banco de Corrientes'],
  brubank: ['brubank', 'Brubank'],
};

/** Nombre del banco en /rewards/banks (normalizado) -> clave de BANCOS, para listar las promos de cada uno. */
const NOMBRE_MODO = {
  'banco nacion': 'nacion', galicia: 'galicia', bbva: 'bbva', santander: 'santander', macro: 'macro', icbc: 'icbc',
  credicoop: 'credicoop', ciudad: 'ciudad', supervielle: 'supervielle', hipotecario: 'hipotecario', comafi: 'comafi',
  yoy: 'yoy', buepp: 'buepp', 'banco corrientes': 'corrientes', brubank: 'brubank',
};
/** Nombra otra provincia o región como alcance de la promo ("supers de cordoba", "comercios de jujuy"). */
const REGIONAL = /\b(supers?|supermercados|comercios|locales|farmacias|estaciones)( adheridos)? (de|del) (santa fe|cordoba|jujuy|salta|tucuman|mendoza|san juan|san luis|la rioja|catamarca|santiago del estero|chaco|formosa|misiones|entre rios|neuquen|rio negro|chubut|santa cruz|tierra del fuego|la pampa|corrientes|rosario|caba|interior)\b|\bsupers federal\b/;

const DIA_EN = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const RESET = { day: 'por_dia', week: 'por_semana', month: 'por_mes' };

const headers = { Accept: 'application/json' };
const getJson = url => C.fetchJson(url, { headers });

async function enPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k).catch(e => ({ error: e.message }));
    }
  }));
  return out;
}

async function listarSlots() {
  try {
    const j = await getJson(`${API}/slots-container/${CONTENEDOR_SLOTS}?source=web_modo`);
    const ids = (j.slots || []).filter(x => x.status === 'active').map(x => x.id);
    if (ids.length) return ids;
  } catch (e) {
    console.warn(`[monitor-agent] No se pudieron leer las secciones de MODO (${e.message}); se usan las conocidas.`);
  }
  return SLOTS_RESPALDO;
}

/** Ids de MODO de los bancos que cubre PagaMejor. Si un banco no aparece, se avisa (pudo cambiar de nombre). */
async function listarBancosModo() {
  const j = await getJson(`${API}/banks?source=app_modo`);
  const lista = Array.isArray(j) ? j : j.data || j.banks || [];
  const ids = [];
  for (const b of lista) {
    const clave = NOMBRE_MODO[C.norm(b.name || '')];
    if (clave) ids.push({ clave, id: b.id });
  }
  const faltan = Object.values(NOMBRE_MODO).filter(k => !ids.some(x => x.clave === k));
  if (faltan.length) console.warn(`[monitor-agent] MODO no lista estos bancos (revisar nombres): ${faltan.join(', ')}`);
  return ids;
}

async function listarCards() {
  const cards = new Map();
  const slots = await listarSlots();
  const bancos = await listarBancosModo();
  // Cada sección sin filtro y filtrada por cada banco: [slot, idBanco|'']
  const consultas = slots.flatMap(slot => [[slot, ''], ...bancos.map(b => [slot, b.id])]);
  await enPool(consultas, 6, async ([slot, banco]) => {
    for (let page = 1; page < 40; page++) {
      const j = await getJson(`${API}/slots?slots=${slot}&banks=${banco}&user_bank_ids=${banco}&limit=50&page=${page}&fcalcstatus=running%2Cfinished_for_product%2Cnext_for_product&slot_info=true`);
      const cs = (j.data && j.data.cards) || [];
      cs.forEach(c => { if (!cards.has(c.slug)) cards.set(c.slug, { ...c, _slot: slot }); });
      if (cs.length < 50) break;
    }
  });
  console.log(`[monitor-agent] ${slots.length} secciones x ${bancos.length + 1} filtros (sin filtro + por banco).`);
  return [...cards.values()];
}

function tycTexto(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

/** Rubro: se conserva el del catálogo si la promo ya existe; si no, heurística marcada como inferida. */
function rubroDe(card, texto, existente) {
  if (existente) return { rubro: existente.rubro, inferido: false };
  const s = C.norm(`${card.title} ${card.search_tags} ${texto}`);
  const reglas = [
    ['supermercado', /supermercad|coto|jumbo|disco|vea|changomas|toledo|carrefour|dia\b|cooperativa obrera|makro|la anonima|almacen/],
    ['combustible', /combustible|ypf|shell|axion|puma|nafta/],
    ['farmacia', /farmac|perfumer|optica|juleriaque|get the look|simplicity/],
    ['gastronomia', /restauran|parrilla|helad|gastronom|cafe|burger|mostaza|havanna/],
    ['transporte', /transporte|colectivo|\bsube\b|subte|estacionamiento/],
    ['indumentaria', /indumentaria|ropa|calzado|deport/], ['mascotas', /veterinar|pet ?shop|mascota/],
    ['libreria', /libreri|jugueter/], ['hogar', /hogar|ferreter|corralon|sodimac/],
  ];
  const hit = reglas.find(([, re]) => re.test(s));
  return { rubro: hit ? hit[0] : 'otros', inferido: true };
}

async function auditarMODO() {
  console.log('[monitor-agent] Consultando API de MODO...');
  const hoy = C.hoyISO();
  const catalogo = C.leerJson(path.join(__dirname, '../../src/data/promos.json'), []);
  const porId = new Map(catalogo.map(p => [p.id, p]));

  const cards = await listarCards();
  const nombreCard = c => C.norm(`${c.title || ''} ${c.slug || ''}`);
  const esCadena = c => C.PRESENCIA_MDP.test(nombreCard(c));
  const corriendo = cards.filter(c => c.calculated_status === 'RUNNING');
  const esPresencial = c => /instore|all|physical/.test(String(c.payment_flow || 'instore'));
  const vigentes = corriendo.filter(esPresencial);
  // Solo online: aplican en cualquier ciudad (no hay locales que verificar); se cargan solo las de marcas conocidas
  const soloOnline = corriendo.filter(c => !esPresencial(c) && esCadena(c));
  console.log(`[monitor-agent] ${cards.length} cards, ${vigentes.length} vigentes con flujo presencial y ${soloOnline.length} solo online de marcas conocidas. Verificando locales en Mar del Plata...`);

  const consultarLocales = (c, zona) => getJson(`${MAP_API}?application_id=${c.promo_id}&source=web_modo&applications=promotions&entities=stores&zone=${zona}`)
    .then(j => (j.pagination && j.pagination.total_results) || 0);
  const mdp = await enPool(vigentes, 8, async c => ({ locales: await consultarLocales(c, ZONA_MDP) }));
  const localesPorSlug = new Map(vigentes.map((c, i) => [c.slug, mdp[i] && mdp[i].locales]));
  const confirmadas = vigentes.filter(c => localesPorSlug.get(c.slug) > 0);
  const sinLocalesMdP = vigentes.filter(c => !(localesPorSlug.get(c.slug) > 0));
  // MODO no publica locales de todas las promos: si no hay datos en ningún lugar del país, "0" no prueba nada
  const pais = await enPool(sinLocalesMdP, 8, async c => ({ locales: await consultarLocales(c, ZONA_PAIS) }));
  const sinDatos = new Set(sinLocalesMdP.filter((c, i) => pais[i] && pais[i].locales === 0).map(c => c.slug));
  const slugsCatalogo = new Set(catalogo.filter(p => String(p.id).startsWith('modo-')).map(p => p.id));
  // Las "sin datos" se incluyen (inactivas, para verificar a mano) solo si ya estaban cargadas en el catálogo:
  // el resto son cientos de promos regionales que no aportan a Mar del Plata
  // Excepción: cadenas de presencia nacional (C.PRESENCIA_MDP, ej. Coto) se incluyen aunque no estuvieran cargadas
  // El mapa de MODO tiene falsos negativos con cadenas grandes (Jumbo y ChangoMás figuran con 0 locales en MdP y
  // MODO las promociona para MdP): una cadena nacional se incluye aunque el mapa no la ubique.
  const inactivasSinDatos = sinLocalesMdP.filter(c => esCadena(c) || (sinDatos.has(c.slug) && slugsCatalogo.has(`modo-${c.slug}`)));
  const enMdP = [...confirmadas, ...inactivasSinDatos, ...soloOnline];
  console.log(`[monitor-agent] ${confirmadas.length} con locales en Mar del Plata; ${inactivasSinDatos.length} sin confirmar por mapa (cadenas nacionales o ya cargadas); ${soloOnline.length} solo online. Leyendo detalle...`);

  const extraidas = [];
  const ignoradas = [];

  const detalles = await enPool(enMdP, 6, async c => ({
    b: await getJson(`${API}/v2/benefit/${c.slug}`),
    banks: await getJson(`${API}/v2/benefit/${c.slug}/banks`),
  }));

  enMdP.forEach((card, i) => {
    const d = detalles[i];
    if (!d || d.error) { ignoradas.push({ slug: card.slug, motivo: `Error al leer detalle: ${d && d.error}` }); return; }
    const { b, banks } = d;
    const offer = (b.offers || [])[0];
    // Promos limitadas a un segmento de clientes del banco (no aplican a cualquier titular)
    const segmento = /target|payroll|sueldo|selecta|platinum|premium|unico|black|\bsupp\b|jubilad|\bps\b|\bidt\b|\brm\b|\bcg\b/i.exec(`${card.slug} ${card.title || ''}`.replace(/-/g, ' '));
    // (las search_tags no sirven para esto: MODO pone etiquetas "SEG_…" también en promos generales)
    if (segmento) { ignoradas.push({ slug: card.slug, motivo: `Segmento específico de clientes ("${segmento[0]}"): no aplica a cualquier titular` }); return; }
    // Promos de otra provincia ("Supermercados de Santa Fe"): el mapa de MODO a veces ubica mal algún local
    const regional = REGIONAL.exec(C.norm(`${card.title || ''} ${(card.slug || '').replace(/-/g, ' ')}`));
    if (regional) { ignoradas.push({ slug: card.slug, motivo: `Promo regional ("${regional[0]}"): no aplica en Mar del Plata` }); return; }
    const cb = offer && offer.outcomes && offer.outcomes.cashback;
    if (!cb || cb.amount_type !== 'percent' || !cb.amount) {
      ignoradas.push({ slug: card.slug, motivo: 'Sin reintegro porcentual (financiación u otro beneficio)' });
      return;
    }
    const motivos = [];
    const notas = [];
    if (!esPresencial(card)) {
      notas.push('Solo online (aplica en cualquier ciudad).');
    } else if (!(localesPorSlug.get(card.slug) > 0)) {
      if (esCadena(card)) notas.push('El mapa de MODO no ubica locales en Mar del Plata (tiene falsos negativos con cadenas grandes); se asume presencia por ser cadena nacional.');
      else motivos.push('No se pudo confirmar presencia en Mar del Plata con el mapa de MODO (verificar a mano).');
    }
    const tyc = tycTexto(b.terms_and_conditions);
    const sch = (b.conditions && b.conditions.schedule) || {};

    // Días
    const dias = (sch.days_of_week || []).map(x => DIA_EN[x]).filter(x => x !== undefined).sort();
    if (!dias.length) motivos.push('El cronograma no indica días.');
    // Vigencia
    const desde = (sch.start_date || '').slice(0, 10);
    const hasta = (sch.stop_date || '').slice(0, 10);
    if (!desde || !hasta) motivos.push('Sin fechas de vigencia en el cronograma.');
    if (hasta && hasta < hoy) { ignoradas.push({ slug: card.slug, motivo: `Vencida el ${hasta}` }); return; }
    if (sch.daily_start_time && !/^00:00/.test(sch.daily_start_time) || sch.daily_stop_time && !/^23:5/.test(sch.daily_stop_time)) {
      notas.push(`Horario acotado: ${sch.daily_start_time} a ${sch.daily_stop_time}.`);
    }

    // Tope
    const cap = offer.limits && offer.limits.period_cap;
    const txCap = offer.limits && offer.limits.transaction_cap && offer.limits.transaction_cap.amount_by_transaction;
    let tipoTope = null;
    let montoTope = null;
    if (cap && cap.amount_by_period > 0) {
      if (RESET[cap.reset_by]) { tipoTope = RESET[cap.reset_by]; montoTope = cap.amount_by_period; }
      else motivos.push(`Tope de $${cap.amount_by_period} con período "${cap.reset_by}" no soportado; no se asume.`);
    } else if (txCap > 0) {
      tipoTope = 'por_compra'; montoTope = txCap;
    } else if (/sin tope/.test(C.norm(tyc))) {
      tipoTope = 'sin_tope';
    } else {
      motivos.push('La API no informa tope y los T&C no dicen "sin tope"; no verificable.');
    }
    if (cap && cap.amount_by_period > 0 && txCap > 0) notas.push(`Además tope por operación de $${txCap}.`);

    const minimo = (offer.requirements && offer.requirements.amount_range && offer.requirements.amount_range.min) || null;

    // Medio de pago
    const flujos = (b.conditions.payment_flow && b.conditions.payment_flow.flows) || [];
    const tieneCred = (b.credit_list || []).length > 0;
    const tieneDeb = (b.debit_list || []).length > 0;
    const tipoMedio = tieneCred && tieneDeb ? 'cualquiera' : tieneCred ? 'credito' : tieneDeb ? 'debito' : 'cualquiera';
    const online = flujos.includes('online');
    const nfc = flujos.includes('instore_nfc');

    // Bancos
    const idsBanco = (offer.requirements && offer.requirements.banks && offer.requirements.banks.list) || [];
    const porUuid = new Map((banks.banks || []).map(x => [x.id, x]));
    const habilitados = idsBanco.map(u => porUuid.get(u)).filter(Boolean);
    let destinos;
    if (habilitados.length === 0 || habilitados.length >= 10) {
      destinos = [{ id: 'modo', nombre: 'MODO', sufijo: '' }];
    } else {
      destinos = [];
      for (const bk of habilitados) {
        const m = BANCOS[bk.hub_bank_id];
        if (m) destinos.push({ id: m[0], nombre: m[1], sufijo: habilitados.length > 1 ? `-${bk.hub_bank_id}` : '' });
        else notas.push(`Banco "${bk.name}" no soportado en bancos.json; omitido.`);
      }
      if (!destinos.length) { ignoradas.push({ slug: card.slug, motivo: `Bancos no soportados: ${habilitados.map(x => x.name).join(', ')}` }); return; }
    }

    const idBase = `modo-${card.slug}`;
    const existente = porId.get(idBase) || porId.get(`${idBase}${destinos[0].sufijo}`);
    const { rubro, inferido } = rubroDe(card, b.description, existente);
    // La descripción a veces es publicidad que no nombra el comercio ("Todos los días pagando con tu tarjeta…"):
    // en ese caso se usa el título de la card y se avisa para que el data-agent lo confirme
    const limpio = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const esPublicidad = (t) => /^(todos los|todas las|disfrut|pag[aá]\b|pagando|v[aá]lid|con tu|seg_|los (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados|domingos))|^aprovech[aá] (el )?\d+% de reintegro y\b/i.test(t);
    let comercio = limpio(b.description || b.name || card.title);
    if (esPublicidad(comercio)) {
      const alternativa = [b.name, card.title].map(limpio).find((t) => t && !esPublicidad(t));
      notas.push(`La descripción no nombra el comercio ("${comercio.slice(0, 60)}"): ${alternativa ? `se usó "${alternativa}"` : 'completar a mano'} (ver ${card.slug}).`);
      if (alternativa) comercio = alternativa;
    }
    const medio = `Tarjetas ${tipoMedio === 'credito' ? 'de crédito' : tipoMedio === 'debito' ? 'de débito' : 'de crédito o débito'} ${online ? 'en local o tienda online' : 'vía QR en local'} con app MODO o app bancaria adherida`;
    if (nfc) notas.push('Admite pago NFC (contactless) desde la billetera.');
    if (inferido) notas.push('Rubro inferido automáticamente: confirmar.');
    if ((offer.outcomes.financing && (offer.outcomes.financing.installments || []).length)) notas.push('Incluye cuotas sin interés.');

    for (const dest of destinos) {
      const id = `${idBase}${dest.sufijo}`;
      extraidas.push({
        id,
        bancoBilleteraId: dest.id,
        bancoBilleteraNombre: dest.nombre,
        tipoMedioRequerido: tipoMedio,
        medioPagoDetalle: dest.id === 'modo' ? medio : `${medio} (${dest.nombre})`,
        rubro,
        diasSemana: dias,
        diasTexto: C.diasATexto(dias),
        vigenciaDesde: desde || hoy,
        vigenciaHasta: hasta || hoy,
        porcentajeDescuento: cb.amount,
        tipoTope: tipoTope || 'sin_tope',
        montoTope,
        minimoCompra: minimo,
        montoGastoOptimo: C.gastoOptimo(montoTope, cb.amount),
        condicionUso: online
          ? 'Pagar con el botón MODO en el checkout online o escaneando el QR en el local, con tarjeta vinculada a MODO.'
          : 'Escanear el código QR en la caja con la app MODO o tu app bancaria adherida y abonar con tarjeta vinculada.',
        localesAdheridos: comercio,
        aclaraciones: [
          `${cb.amount}% de reintegro ${C.diasATexto(dias).toLowerCase()} en ${comercio}.`,
          tipoTope === 'sin_tope' ? 'Sin tope.' : montoTope ? `Tope $${montoTope.toLocaleString('es-AR')} ${tipoTope.replace('por_', 'por ')}.` : '',
          minimo ? `Mínimo de compra $${minimo.toLocaleString('es-AR')}.` : '',
          localesPorSlug.get(card.slug) > 0 ? `Verificado con ${localesPorSlug.get(card.slug)} locales en Mar del Plata.` : '',
          ...notas,
          motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
        ].filter(Boolean).join(' '),
        fuenteUrl: `https://www.modo.com.ar/promos/${card.slug}`,
        fuenteId: FUENTE_ID,
        ultimaVerificacion: hoy,
        activo: motivos.length === 0,
        _meta: { localesMdP: localesPorSlug.get(card.slug), rubroInferido: inferido, flujos },
      });
    }
  });

  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'MODO',
    bancoIds: [],
    extraidas,
    ignoradas,
    // Catálogo MODO = promos con fuenteId 'modo' o ids modo-* heredados de la carga manual
    filtroCatalogo: p => p.fuenteId === FUENTE_ID || String(p.id).startsWith('modo-'),
  });
}

auditarMODO().catch(err => {
  console.error('[monitor-agent] Error en auditoría de MODO:', err);
  process.exit(1);
});
