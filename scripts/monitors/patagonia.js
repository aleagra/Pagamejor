/**
 * Monitor Agent: Extractor y Auditor de Banco Patagonia (Club Patagonia - Ahorros y Beneficios)
 * Fuente: https://ahorrosybeneficios.bancopatagonia.com.ar/
 *
 * Método (estático, Magento):
 *  1. Por categoría (/ahorrosybeneficios/<categoria>.html?product_list_limit=36) se listan las promos.
 *  2. Cada detalle trae: días, rango de fechas, y los 3 niveles de cuenta (Clásica / Plus / Singular)
 *     con su % y su tope; el legal indica período del tope, medios de pago y alcance geográfico.
 *
 * Reglas:
 *  - Se guardan los 3 niveles en `niveles`; `porcentajeDescuento` = piso (menor nivel, normalmente Clásica).
 *  - EXCLUIDAS (no se cargan, se reportan en `ignoradas`): promos exclusivas de Río Negro u otra
 *    provincia, "Plan Sueldo"/acreditación de haberes, usuarios nuevos, y categorías regionales/estacionales.
 *  - Nada se completa por defecto: sin tope/período/vigencia verificables => activo:false + nota.
 */

const cheerio = require('cheerio');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'patagonia';
const ORIGEN = 'https://ahorrosybeneficios.bancopatagonia.com.ar';
const BASE = `${ORIGEN}/ahorrosybeneficios`;

/** categoría -> rubro. Las que no están acá se auditan pero con rubro 'otros'. */
const RUBRO = {
  supermercados: 'supermercado', combustibles: 'combustible', gastronomia: 'gastronomia',
  'farmacias-y-perfumerias': 'farmacia', 'indumentaria-y-deportes': 'indumentaria',
  'librerias-y-jugueterias': 'libreria', mascota: 'mascotas', hogar: 'hogar', espectaculos: 'entretenimiento',
};
/** Categorías que no aplican a Mar del Plata / no son compras cotidianas. */
const EXCLUIR_CATEGORIAS = {
  'rio-negro': 'Categoría exclusiva de Río Negro',
  invierno: 'Categoría estacional de centros de ski (Patagonia andina)',
  laderas: 'Centro de ski (otra provincia)',
  'centro-de-ski-catedral': 'Centro de ski (otra provincia)',
  mundial: 'Campaña estacional',
  balc: 'Beneficio de otra zona (BALC)',
  'shopping-y-paseos': 'Paseos de compras de otras ciudades (ninguno de Mar del Plata; verificado 2026-09-29)',
  modo: 'Promos vía MODO: se auditan en la fuente MODO',
};
const NIVELES = { CLASICA: 'Clásica', PLUS: 'Plus', SINGULAR: 'Singular' };
const PROVINCIAS_OTRAS = /r[ií]o negro|neuqu[eé]n|chubut|santa cruz|tierra del fuego|mendoza|c[oó]rdoba|santa fe|entre r[ií]os|la pampa|salta|san juan|san luis|tucum[aá]n|jujuy|misiones|corrientes|chaco|formosa|catamarca|la rioja|santiago del estero/i;

async function categorias() {
  const $ = cheerio.load(await C.fetchText(`${ORIGEN}/`));
  const set = new Set();
  $('a[href*="/ahorrosybeneficios/"]').each((_, a) => {
    const m = /\/ahorrosybeneficios\/([a-z0-9-]+)\.html/.exec($(a).attr('href') || '');
    if (m && (RUBRO[m[1]] || EXCLUIR_CATEGORIAS[m[1]] || ['peluqueria', 'shopping-y-paseos', 'automotor', 'educacion', 'transporte', 'servicios', 'turismo', 'patagonia-sale'].includes(m[1]))) set.add(m[1]);
  });
  return [...set];
}

async function listarCategoria(cat) {
  const links = new Map();
  for (let p = 1; p < 10; p++) {
    const $ = cheerio.load(await C.fetchText(`${BASE}/${cat}.html?product_list_limit=36&p=${p}`));
    const antes = links.size;
    $('.product-item-link').each((_, a) => {
      const href = $(a).attr('href');
      if (href && !links.has(href)) links.set(href, $(a).text().trim());
    });
    if (links.size === antes || $('.product-item').length < 36) break;
  }
  return [...links.entries()].map(([url, nombre]) => ({ url, nombre, cat }));
}

function parsearDetalle(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,svg').remove();
  const main = $('.product-info-main').first().text().replace(/\s+/g, ' ').trim();
  const pagina = $('.column.main').first().text().replace(/\s+/g, ' ').trim() || main;
  const legales = [];
  const iTyc = pagina.search(/T[eé]rminos y Condiciones/);
  const legalAll = iTyc >= 0 ? pagina.slice(iTyc + 21).replace(/Available stores.*$/i, '') : '';
  // Un bloque por "Legales Patagonia <niveles>" (o uno solo si el banco publica un único legal)
  const bloques = legalAll.split(/Legales? Patagonia [A-Za-zÁ-ú, ]+?(?=\s*["“]?\s*CARTERA)/i).map(x => x.trim()).filter(x => /CARTERA|PROMOCI[OÓ]N V[AÁ]LIDA/i.test(x));
  bloques.forEach(b => legales.push({ nivel: '', texto: b }));
  let m;

  const cabecera = /(?:SKU\s+\S+\s+)?(.+?)\s+(TODOS LOS [^\d]+?|LUNES[^\d]*?|[A-ZÁÉÍÓÚ ]+?)\s+Del (\d{2}\/\d{2}\/\d{4}) al (\d{2}\/\d{2}\/\d{4})\s*(.*?)\s*(?=(?:CLASICA|PLUS|SINGULAR))/i.exec(main);
  const niveles = [];
  const reNiv = /((?:CLASICA|PLUS|SINGULAR)+)\s*(\d{1,3})%\s*(?:Tope:\s*\$\s*([\d.]+))?/g;
  const zona = main.slice(main.search(/(?:CLASICA|PLUS|SINGULAR)/));
  while ((m = reNiv.exec(zona))) {
    const nombres = m[1].match(/CLASICA|PLUS|SINGULAR/g);
    nombres.forEach(n => niveles.push({ nivel: NIVELES[n], porcentaje: +m[2], montoTope: m[3] ? C.norm(m[3]) && parseInt(m[3].replace(/\./g, ''), 10) : null }));
  }
  const dias = /\bDias\s+(.+?)\s+T[eé]rminos y Condiciones/.exec(pagina)
    || /(TODOS LOS [A-ZÁÉÍÓÚa-záéíóú ]+?|[A-ZÁÉÍÓÚ]+(?: A [A-ZÁÉÍÓÚ]+)?)\s+Del \d{2}\/\d{2}\/\d{4}/.exec(main);
  const etiquetas = cabecera ? cabecera[5] : '';
  return {
    nombre: cabecera ? cabecera[1].trim() : '',
    diasTexto: dias ? dias[1].trim() : '',
    etiquetas: (/Del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}\s*(.*?)\s*(?:CLASICA|PLUS|SINGULAR)/i.exec(main) || [])[1] || etiquetas || '',
    rango: /Del (\d{2}\/\d{2}\/\d{4}) al (\d{2}\/\d{2}\/\d{4})/.exec(main),
    niveles,
    legales,
    main,
  };
}

const fechaDMY = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };

async function auditarPatagonia() {
  console.log('[monitor-agent] Conectando con Banco Patagonia (Club Patagonia)...');
  const hoy = C.hoyISO();
  const cats = await categorias();
  console.log(`[monitor-agent] ${cats.length} categorías: ${cats.join(', ')}`);

  const ignoradas = [];
  const porUrl = new Map();
  for (const cat of cats) {
    if (EXCLUIR_CATEGORIAS[cat]) {
      ignoradas.push({ categoria: cat, motivo: EXCLUIR_CATEGORIAS[cat] });
      continue;
    }
    const items = await listarCategoria(cat);
    console.log(` -> ${cat}: ${items.length} promos`);
    items.forEach(i => { if (!porUrl.has(i.url)) porUrl.set(i.url, i); });
  }

  const extraidas = [];
  for (const item of porUrl.values()) {
    let det;
    try {
      det = parsearDetalle(await C.fetchText(item.url));
    } catch (e) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: `No se pudo leer el detalle: ${e.message}` });
      continue;
    }
    const slug = item.url.split('/').pop().replace('.html', '');
    const legal1 = (det.legales[0] && det.legales[0].texto) || '';
    const textoGeo = `${det.etiquetas} ${legal1}`;

    // ---- Exclusiones (no se cargan)
    if (/r[ií]o negro/i.test(det.etiquetas) || /exclusiv[oa]\s+(?:para\s+)?(?:la\s+)?provincia/i.test(det.etiquetas) || (PROVINCIAS_OTRAS.test(det.etiquetas) && /exclusiv/i.test(det.etiquetas))) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: `Exclusiva de otra provincia ("${det.etiquetas.trim()}")` });
      continue;
    }
    if (/en (?:la )?provincia de (?!buenos aires)|en los (?:supermercados|locales|comercios)[^.]{0,60}de la provincia de (?!buenos aires)/i.test(legal1) && PROVINCIAS_OTRAS.test(legal1.slice(0, 700))) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: 'El legal limita la promo a otra provincia' });
      continue;
    }
    if (/sueldo|haberes|n[oó]mina/i.test(`${det.etiquetas} ${item.nombre}`)) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: `Requiere acreditar sueldo/haberes ("${det.etiquetas.trim()}"): no aplica a cualquier cliente` });
      continue;
    }
    if (/usuarios? nuevos?|nuevos usuarios|primer(?:a|o)s? (?:compra|viaje)/i.test(`${item.nombre} ${item.url} ${legal1.slice(0, 500)}`)) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: 'Solo usuarios nuevos / primera compra' });
      continue;
    }
    if (!det.niveles.length) {
      ignoradas.push({ promo: item.nombre, url: item.url, motivo: 'No se pudieron leer los niveles/porcentajes del detalle' });
      continue;
    }

    // ---- Datos
    const motivos = [];
    const notas = [];
    const dias = C.parseDias(det.diasTexto);
    if (!dias) motivos.push(`No se pudieron determinar los días ("${det.diasTexto}").`);
    let vig = C.parseVigenciaTexto(legal1);
    if (!vig && det.rango) vig = { desde: fechaDMY(det.rango[1]), hasta: fechaDMY(det.rango[2]) };
    if (!vig || !vig.hasta) motivos.push('No se pudo determinar la vigencia.');

    // Período del tope (del legal de cada nivel)
    const periodoDe = t => {
      const n = C.norm(t);
      if (/tope por plazo de vigencia|tope[^a-z]{0,20}por vigencia/.test(n)) return 'vigencia';
      const m = /tope de (?:devolucion|reintegro|descuento)[^a-z]{0,30}(?:pesos\s+[a-z ]{0,40})?\s*(?:(?:por|x)\s+(?:cuenta|usuario|persona|cliente|tarjeta)\s+)*(?:por|x)\s+(mes|semana|dia|compra|operacion|transaccion|ticket)/.exec(n);
      if (!m) return null;
      return { mes: 'por_mes', semana: 'por_semana', dia: 'por_dia' }[m[1]] || 'por_compra';
    };
    const periodos = new Set(det.legales.map(l => periodoDe(l.texto)).filter(Boolean));
    const sinTopeGlobal = det.legales.length && det.legales.every(l => /sin tope/i.test(l.texto)) && det.niveles.every(n => !n.montoTope);
    let tipoTope = null;
    if (sinTopeGlobal) tipoTope = 'sin_tope';
    else if (periodos.has('vigencia')) motivos.push('El tope es por toda la vigencia de la promo (período no soportado por el esquema); no se asume.');
    else if (periodos.size === 1) tipoTope = [...periodos][0];
    else if (periodos.size > 1) motivos.push(`Los niveles tienen períodos de tope distintos (${[...periodos].join(', ')}).`);
    else motivos.push('No se pudo determinar el período del tope en el legal.');
    if (tipoTope && tipoTope !== 'sin_tope' && det.niveles.some(n => !n.montoTope)) motivos.push('Algún nivel no informa monto de tope.');

    const ordenados = ['Clásica', 'Plus', 'Singular'];
    const niveles = det.niveles
      .filter((n, i, a) => a.findIndex(x => x.nivel === n.nivel) === i)
      .sort((a, b) => ordenados.indexOf(a.nivel) - ordenados.indexOf(b.nivel));
    const pcts = new Set(niveles.map(n => n.porcentaje));
    const topes = new Set(niveles.map(n => n.montoTope));
    const piso = Math.min(...niveles.map(n => n.porcentaje));
    const nivelPiso = niveles.find(n => n.porcentaje === piso);
    const usarNiveles = niveles.length >= 2 && (pcts.size > 1 || topes.size > 1);
    // Si la promo no cubre los 3 niveles, el "piso" no está garantizado para todos los clientes
    const faltan = ordenados.filter(n => !niveles.some(x => x.nivel === n));
    if (faltan.length) motivos.push(`La promo no lista el nivel ${faltan.join(' ni ')}: aplica solo a ${niveles.map(n => n.nivel).join(' / ')}.`);

    // Medios (legal)
    const t1 = C.norm(legal1);
    const tLegalTodo = C.norm(det.legales.map(l => l.texto).join(' ') || det.main);
    const debito = /debito/.test(tLegalTodo.slice(0, 900));
    const credito = /credito/.test(tLegalTodo.slice(0, 900));
    if (!debito && !credito) motivos.push('El legal no aclara el medio de pago.');
    const medio = debito && credito ? 'Tarjetas de débito Patagonia 24 y de crédito emitidas por Banco Patagonia'
      : credito ? 'Tarjetas de crédito Visa/Mastercard emitidas por Banco Patagonia'
      : 'Tarjeta de débito Patagonia 24';
    const minimo = C.parseMinimo(legal1);
    if (/solo|exclusiv|nfc/i.test(det.etiquetas)) notas.push(`Etiqueta de la promo: ${det.etiquetas.trim()}.`);
    if (/\bnfc\b/i.test(`${item.nombre} ${slug} ${legal1.slice(0, 400)}`)) notas.push('Requiere pago NFC/contactless.');
    if (/1 pago/.test(t1)) notas.push('Compras en 1 pago.');
    const excl = /se excluye[^.]*\./i.exec(legal1);
    if (excl) notas.push(excl[0].trim().slice(0, 200));

    if (!C.PRESENCIA_MDP.test(C.norm(`${item.nombre} ${slug}`))) {
      motivos.push('Presencia en Mar del Plata no confirmada (comercio regional/local o no listado como cadena nacional): verificar a mano antes de activar.');
    }
    const rubro = RUBRO[item.cat] || 'otros';
    const montoTope = tipoTope && tipoTope !== 'sin_tope' ? (nivelPiso && nivelPiso.montoTope) : null;
    const nombre = item.nombre;

    extraidas.push({
      id: `pat-${slug}`,
      bancoBilleteraId: 'banco-patagonia',
      bancoBilleteraNombre: 'Banco Patagonia',
      tipoMedioRequerido: debito && credito ? 'cualquiera' : credito ? 'credito' : 'debito',
      medioPagoDetalle: medio,
      rubro,
      diasSemana: dias || [],
      diasTexto: C.diasATexto(dias),
      vigenciaDesde: (vig && vig.desde) || hoy,
      vigenciaHasta: (vig && vig.hasta) || hoy,
      porcentajeDescuento: piso,
      ...(usarNiveles ? { niveles: niveles.map(n => ({ nivel: n.nivel, porcentaje: n.porcentaje, montoTope: n.montoTope || null })) } : {}),
      tipoTope: tipoTope || 'sin_tope',
      montoTope,
      minimoCompra: minimo,
      montoGastoOptimo: C.gastoOptimo(montoTope, piso),
      condicionUso: `Pagar en ${nombre} con ${medio}.`,
      localesAdheridos: nombre,
      aclaraciones: [
        usarNiveles ? `Descuento por nivel de cuenta: ${niveles.map(n => `${n.nivel} ${n.porcentaje}%${n.montoTope ? ` (tope $${n.montoTope.toLocaleString('es-AR')})` : ''}`).join(', ')}.` : `${piso}% de descuento.`,
        tipoTope && tipoTope !== 'sin_tope' ? `Tope ${tipoTope.replace('por_', 'por ')} y por cuenta.` : tipoTope === 'sin_tope' ? 'Sin tope.' : '',
        ...notas,
        motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
      ].filter(Boolean).join(' '),
      fuenteUrl: item.url,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
      _meta: { categoria: item.cat },
    });
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Banco Patagonia', bancoIds: ['banco-patagonia'], extraidas, ignoradas });
}

auditarPatagonia().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Banco Patagonia:', err);
  process.exit(1);
});
