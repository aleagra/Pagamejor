/**
 * Monitor Agent: Extractor y Auditor de Brubank
 * Fuente: https://www.brubank.com/beneficios (estática) + cada "Ir a promo" -> artículo de bases en help.brubank.com
 *
 * Las bases de cada promo tienen todo lo necesario y son la fuente de verdad:
 *   - Plan: "Clientes Brubank" (todos), "Plan Plus" o "Plan Ultra" (planes pagos).
 *   - Días ("válida los días viernes, sábados y domingos"), vigencia, % y tope ("tope de $6.000 por Compra
 *     Participante"), y el Anexo I con la dirección de cada local adherido (se busca "Mar del Plata").
 *   - Algunas exigen tocar "Jugá y Participá por Premios" en la app el mismo día: se avisa en condicionUso.
 *
 * Alcance: SOLO promos presenciales con reintegro %, vigentes y con locales en Mar del Plata (o de cadenas
 * nacionales sin anexo, ver C.PRESENCIA_MDP). Las de Plan Plus/Ultra quedan activo:false: PagaMejor todavía no
 * pregunta el plan, y recomendarlas a cualquier cliente rompería el filtro estricto.
 */

const cheerio = require('cheerio');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'brubank';
const LISTADO = 'https://www.brubank.com/beneficios';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36' };

function planDe(texto) {
  if (/plan ultra/i.test(texto)) return 'Ultra';
  if (/plan plus/i.test(texto)) return 'Plus';
  return null; // "Clientes Brubank": cualquier cliente
}

/** "…OFF en "Farmacity, "Simplicity", "Get The Look"…" -> "Farmacity, Simplicity y Get The Look". */
function comercioDe(titulo) {
  // Sin comillas (a veces vienen anidadas o sin cerrar): el tramo entre "OFF en" y "Comprá/comprando/con tu"
  const limpio = titulo.replace(/[“”"]/g, '');
  const tramo = (/ en (?:la carga de combustible en |la |el )?(.+?)(?:\.\s|\. Compr| comprando| compr[aá]| con tu|$)/i.exec(limpio) || [])[1] || limpio;
  const nombres = tramo.split(/\s*,\s*|\s+y\s+/);
  const unicos = [...new Set(nombres.map(n => n.trim()).filter(Boolean))];
  return unicos.length > 1 ? `${unicos.slice(0, -1).join(', ')} y ${unicos[unicos.length - 1]}` : unicos[0];
}

async function auditarBrubank() {
  console.log('[monitor-agent] Leyendo beneficios de Brubank...');
  const hoy = C.hoyISO();
  const $ = cheerio.load(await C.fetchText(LISTADO, { headers: UA }));
  const links = [...new Set($('a[href*="help.brubank.com"]').map((i, e) => $(e).attr('href').split('?')[0].replace('http://', 'https://')).get())];
  console.log(`[monitor-agent] ${links.length} artículos enlazados. Leyendo bases...`);

  const extraidas = [];
  const ignoradas = [];

  for (const url of links) {
    let a;
    try {
      a = cheerio.load(await C.fetchText(url, { headers: UA }));
    } catch (e) {
      ignoradas.push({ url, motivo: `No se pudo leer el artículo: ${e.message}` });
      continue;
    }
    const titulo = a('h1').first().text().replace(/\s+/g, ' ').trim();
    const texto = (a('article').text() || a('body').text()).replace(/\s+/g, ' ');
    const tn = C.norm(texto);

    const pctM = /corresponde al (\d{1,3})\s?%/.exec(tn) || /(\d{1,3})\s?% (?:off|de (?:descuento|reintegro))/.exec(C.norm(titulo));
    if (!pctM) { if (/%|cuota/i.test(titulo)) ignoradas.push({ url, titulo, motivo: 'Sin reintegro porcentual (cuotas u otro beneficio)' }); continue; }
    const pct = +pctM[1];
    if (/compr[aá] online|tienda online|en la web|online con tu/i.test(`${titulo} ${texto.slice(0, 600)}`) && !/presencial/i.test(titulo)) {
      ignoradas.push({ url, titulo, motivo: 'Solo online' });
      continue;
    }

    const vig = C.parseVigenciaTexto(texto);
    if (!vig || !vig.hasta) { ignoradas.push({ url, titulo, motivo: 'Vigencia no interpretable en las bases' }); continue; }
    if (vig.hasta < hoy) { ignoradas.push({ url, titulo, motivo: `Vencida el ${vig.hasta}` }); continue; }

    const comercio = comercioDe(titulo);
    const anexo = texto.search(/ANEXO\s*I\b/i);
    const locales = anexo >= 0 ? texto.slice(anexo) : '';
    const enMdP = (C.norm(locales).match(/mar del plata/g) || []).length;
    const cadena = C.PRESENCIA_MDP.test(C.norm(comercio));
    if (!enMdP && !(anexo < 0 && cadena)) {
      ignoradas.push({ url, titulo, motivo: anexo >= 0 ? 'El anexo de locales no incluye Mar del Plata' : 'Sin anexo de locales y no es cadena nacional' });
      continue;
    }

    const motivos = [];
    const notas = [];
    notas.push(enMdP ? `El anexo lista ${enMdP} locales en Mar del Plata.` : 'Las bases no listan locales; se asume presencia en Mar del Plata por ser cadena nacional.');
    const plan = planDe(texto.slice(0, 700));
    if (plan) motivos.push(`Solo clientes con Plan ${plan} (pago): PagaMejor todavía no pregunta el plan.`);

    const tramoDias = (/v[aá]lida\s+(?:para\s+)?(?:los\s+d[ií]as\s+|todos\s+los\s+d[ií]as)[^(“"]{0,80}/i.exec(texto) || [])[0] || titulo;
    const dias = C.parseDias(tramoDias) || C.parseDias(titulo);
    if (!dias || !dias.length) motivos.push('No se pudieron leer los días.');

    const tope = C.parseTope(texto);
    if (!tope || (tope.tipoTope !== 'sin_tope' && !tope.tipoTope)) motivos.push('Tope no verificable en las bases.');
    const limite = /l[ií]mite de (\d+|una|uno)\s*\(?[^)]*\)?\s*(?:transacci[oó]n|compras? participantes?)[^.]{0,60}/i.exec(texto);
    if (limite) notas.push(`Límite: ${limite[0].trim()}.`);
    const juego = /jug[aá] y particip[aá]/i.test(texto);

    const diasOk = dias || [];
    extraidas.push({
      id: `bru-${C.slugify(comercio)}-${plan ? plan.toLowerCase() : 'todos'}-${diasOk.join('')}`,
      bancoBilleteraId: 'brubank',
      bancoBilleteraNombre: 'Brubank',
      tipoMedioRequerido: 'cualquiera',
      medioPagoDetalle: 'Tarjeta de débito o crédito Visa Brubank (física o virtual)',
      rubro: rubroDe(comercio),
      diasSemana: diasOk,
      diasTexto: C.diasATexto(diasOk),
      vigenciaDesde: vig.desde || hoy,
      vigenciaHasta: vig.hasta,
      porcentajeDescuento: pct,
      tipoTope: tope && tope.tipoTope ? tope.tipoTope : 'sin_tope',
      montoTope: tope && tope.montoTope ? tope.montoTope : null,
      minimoCompra: C.parseMinimo(texto),
      montoGastoOptimo: C.gastoOptimo(tope && tope.montoTope, pct),
      condicionUso: `Pagar presencialmente en ${comercio} con la tarjeta Visa de débito o crédito Brubank (no vale QR con saldo en cuenta).${juego ? ' Después de pagar, entrar a la app, tocar la compra con la leyenda "Promo" y elegir "Jugá y Participá por Premios" ese mismo día: si no, no hay reintegro.' : ''}`,
      localesAdheridos: comercio,
      aclaraciones: `${notas.join(' ')}${motivos.length ? ' REVISAR: ' + motivos.join(' ') : ''}`.trim(),
      fuenteUrl: url,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
    });
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Brubank', bancoIds: ['brubank'], extraidas, ignoradas });
}

function rubroDe(comercio) {
  const s = C.norm(comercio);
  if (/axion|ypf|shell|puma/.test(s)) return 'combustible';
  if (/farmacity|simplicity|get the look|perfum|optic/.test(s)) return 'farmacia';
  if (/coto|carrefour|dia\b|changomas|jumbo|disco|vea|toledo|anonima/.test(s)) return 'supermercado';
  if (/cabify|taxi|uber/.test(s)) return 'transporte';
  if (/burger|freddo|pain|cafe|rapanui|cabrera|cucina|tucson|luccian|chungo|deniro|molina|cervelar|mala/.test(s)) return 'gastronomia';
  return 'otros';
}

auditarBrubank().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Brubank:', err);
  process.exit(1);
});
