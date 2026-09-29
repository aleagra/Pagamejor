/**
 * Monitor Agent: Extractor y Auditor de Ualá
 * Fuente: https://www.uala.com.ar/promociones
 *
 * Método (estático): la card del listado solo trae % y medios de pago; los DÍAS, TOPE, VIGENCIA y
 * condiciones están en cada detalle (/promociones/<slug>):
 *   - Días: selector "LMMJVSD" donde los activos llevan la clase `bg-blue-250` (los demás solo borde).
 *   - Tope / Válido hasta / Métodos / Tipo de comercio / Disponible en: campos rotulados.
 *   - Vigencia y restricciones: texto de "Términos y condiciones".
 *
 * Reglas: nada se completa por defecto. Promos de un solo uso / solo usuarios nuevos / condicionadas
 * se cargan `activo:false` con la explicación (no son un beneficio recurrente de pago).
 */

const cheerio = require('cheerio');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'uala';
const BASE = 'https://www.uala.com.ar';
const LISTADO = `${BASE}/promociones`;
const ORDEN_LETRAS = [1, 2, 3, 4, 5, 6, 0]; // L M M J V S D

/** Rubro por promo (explícito). Sin entrada => 'otros'. */
const RUBRO = { rappi: 'gastronomia' };
/** Promos que, aun sin las palabras clave, son condicionadas (motivo). */
const CONDICIONADAS = {
  cabify100: 'Condicionada: el cupón de 100% se obtiene tras completar un viaje entre 7:00 y 8:59 (L a V) y solo sirve para el segundo viaje del mismo día.',
};

function extraerCampo(texto, rotulo, siguiente) {
  const re = new RegExp(`${rotulo}:\\s*(.+?)\\s*(?:(?:${siguiente.join('|')}):|Términos y condiciones)`, 'i');
  const m = re.exec(texto);
  return m ? m[1].trim() : null;
}

async function auditarUala() {
  console.log('[monitor-agent] Conectando con Ualá Promociones...');
  const hoy = C.hoyISO();
  const $ = cheerio.load(await C.fetchText(LISTADO));

  const slugs = [];
  $('a[href^="/promociones/"]').each((_, el) => {
    const slug = ($(el).attr('href') || '').split('/').filter(Boolean).pop();
    if (slug && slug !== 'promociones' && !slugs.includes(slug)) slugs.push(slug);
  });
  console.log(`[monitor-agent] ${slugs.length} promociones en el listado.`);

  const extraidas = [];
  const ignoradas = [];

  for (const slug of slugs) {
    const url = `${LISTADO}/${slug}`;
    let d$;
    try {
      d$ = cheerio.load(await C.fetchText(url));
    } catch (e) {
      ignoradas.push({ slug, motivo: `No se pudo leer el detalle: ${e.message}` });
      continue;
    }

    // Días activos del selector
    const letras = d$('h5:contains("Días")').first().parent().find('div.flex-wrap > div');
    const dias = [];
    letras.each((i, el) => {
      if (/bg-blue-250/.test(d$(el).attr('class') || '')) dias.push(ORDEN_LETRAS[i]);
    });

    d$('script,style,noscript,svg').remove();
    const pagina = d$('body').text().replace(/\s+/g, ' ');
    const cuerpo = pagina.slice(Math.max(0, pagina.indexOf('Regresar a promociones')));
    const titulo = (/Regresar a promociones\s*(.+?)\s*(?:Aprovechalo|Detalles)/.exec(cuerpo) || [])[1] || slug;
    const CAMPOS = ['Días', 'Métodos? de pago', 'Tipo de comercio', 'Válido hasta', 'Tope de reintegro', 'Tiempo de acreditación', 'Disponible en', 'Términos y condiciones'];
    const campo = r => extraerCampo(cuerpo, r, CAMPOS.filter(c => c !== r));
    const metodos = campo('Métodos? de pago') || '';
    const tipoComercio = campo('Tipo de comercio') || '';
    const topeTxt = campo('Tope de reintegro') || '';
    const disponible = campo('Disponible en') || '';
    const validoHasta = campo('Válido hasta') || '';
    const tyc = cuerpo.slice(cuerpo.indexOf('Términos y condiciones'));

    const pctM = /(\d{1,3})%/.exec(titulo);
    const motivos = [];
    const notas = [];
    if (!pctM) {
      ignoradas.push({ slug, motivo: `Sin porcentaje de reintegro/descuento en el título ("${titulo.slice(0, 60)}")` });
      continue;
    }
    const pct = +pctM[1];

    // Días: selector, acotado por el T&C si este dice "de lunes a viernes"
    let diasFinal = dias;
    const rangoTyc = /(?:aplicable|v[aá]lid[oa]s?)\s+(?:solo\s+)?de\s+((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+a\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))/i.exec(tyc);
    if (rangoTyc) {
      const dTyc = C.parseDias(rangoTyc[1]);
      if (dTyc && dTyc.length < diasFinal.length) {
        diasFinal = diasFinal.filter(x => dTyc.includes(x));
        notas.push(`Los T&C acotan los días a ${rangoTyc[1]} (el selector mostraba más).`);
      }
    }
    if (!diasFinal.length) motivos.push('No se pudieron determinar los días de vigencia.');

    // Vigencia: T&C manda; "Válido hasta" contrasta
    let vig = C.parseVigenciaTexto(tyc);
    const hastaCampo = C.parseVigenciaTexto(`válido hasta el ${validoHasta.replace(/^Hasta el\s*/i, '')}`);
    if (!vig || !vig.hasta) {
      if (hastaCampo && hastaCampo.hasta) { vig = { desde: null, hasta: hastaCampo.hasta }; notas.push('Vigencia tomada del campo "Válido hasta" (los T&C no la detallan).'); }
    } else if (hastaCampo && hastaCampo.hasta && hastaCampo.hasta !== vig.hasta) {
      notas.push(`Ojo: "Válido hasta" dice ${hastaCampo.hasta} y los T&C ${vig.hasta}; se usa el de los T&C.`);
    }
    if (!vig || !vig.hasta) motivos.push('No se pudo determinar la vigencia.');

    // Tope
    const tope = C.parseTope(`Tope ${topeTxt}`.replace(/Tope\s+Sin tope/i, 'Sin tope')) || (/sin tope/i.test(topeTxt) ? { tipoTope: 'sin_tope', montoTope: null } : null);
    let tipoTope = null;
    let montoTope = null;
    if (tope && tope.tipoTope === 'sin_tope') tipoTope = 'sin_tope';
    else if (tope && tope.tipoTope && tope.montoTope) { tipoTope = tope.tipoTope; montoTope = tope.montoTope; }
    else motivos.push(`Tope no verificable (campo: "${topeTxt || '-'}").`);

    // Medio de pago
    const prepaga = /prepaga/i.test(metodos);
    const credito = /cr[eé]dito/i.test(metodos);
    if (!prepaga && !credito) motivos.push('Sin método de pago informado.');
    const medio = prepaga && credito ? 'Tarjeta Prepaga o de Crédito Ualá (Mastercard)' : credito ? 'Tarjeta de Crédito Ualá (Mastercard)' : 'Tarjeta Prepaga Ualá (Mastercard)';

    // Un solo uso / usuarios nuevos / condicionada => no es un beneficio recurrente de pago
    const unaVez = /usuarios? nuevos?|nuevos usuarios|por [uú]nica vez|primeros? \d+|primer[oa]?s? (?:viaje|mes|compra)|suscripci[oó]n|cup[oó]n/i.exec(`${titulo} ${tyc.slice(0, 2500)}`);
    const noRecurrente = CONDICIONADAS[slug] || (unaVez && `Beneficio de un solo uso / suscripción / condicionado (los T&C mencionan "${unaVez[0]}"); no es un descuento recurrente al pagar.`);
    if (noRecurrente) {
      ignoradas.push({ slug, titulo, motivo: noRecurrente });
      continue;
    }

    const fisico = /f[ií]sico/i.test(tipoComercio);
    const rubro = RUBRO[slug] || 'otros';
    if (!/todo el pa[ií]s/i.test(disponible)) motivos.push(`Disponibilidad geográfica no confirmada para Mar del Plata ("${disponible || '-'}").`);

    extraidas.push({
      id: `uala-${slug}`,
      bancoBilleteraId: 'uala',
      bancoBilleteraNombre: 'Ualá',
      tipoMedioRequerido: prepaga && credito ? 'cualquiera' : credito ? 'credito' : 'cuenta',
      medioPagoDetalle: medio,
      rubro,
      diasSemana: diasFinal,
      diasTexto: C.diasATexto(diasFinal),
      vigenciaDesde: (vig && vig.desde) || hoy,
      vigenciaHasta: (vig && vig.hasta) || hoy,
      porcentajeDescuento: pct,
      tipoTope: tipoTope || 'sin_tope',
      montoTope,
      minimoCompra: null,
      montoGastoOptimo: C.gastoOptimo(montoTope, pct),
      condicionUso: fisico
        ? `Pagar presencialmente con ${medio} (contactless desde la billetera del celular).`
        : `Pagar online en ${titulo.replace(/^\d+%\s*de\s*(?:reintegro|descuento)\s*/i, '').trim() || slug} con ${medio}.`,
      localesAdheridos: titulo.replace(/\s+/g, ' ').trim(),
      aclaraciones: [
        `${pct}% ${/reintegro/i.test(titulo) ? 'de reintegro' : 'de descuento'} (${fisico ? 'presencial' : tipoComercio || 'online'}).`,
        tipoTope === 'sin_tope' ? 'Sin tope.' : montoTope ? `Tope $${montoTope.toLocaleString('es-AR')} ${tipoTope.replace('por_', 'por ')}.` : '',
        ...notas,
        motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
      ].filter(Boolean).join(' '),
      fuenteUrl: url,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
    });
    console.log(` -> ${slug}: ${pct}% | ${C.diasATexto(diasFinal)} | hasta ${vig && vig.hasta} | ${tipoTope}${montoTope ? ' ' + montoTope : ''}${motivos.length ? ' [INACTIVA]' : ''}`);
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Ualá', bancoIds: ['uala'], extraidas, ignoradas });
}

auditarUala().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Ualá:', err);
  process.exit(1);
});
