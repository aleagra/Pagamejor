/**
 * Monitor Agent: Extractor y Auditor de Banco de Corrientes
 * Fuente: https://promosdelbanco.com (sitio oficial de promos del banco; la API de WordPress está restringida,
 * así que se lee el HTML público).
 *
 * Casi todas sus promos son de comercios de Corrientes y Misiones: cada página trae una tabla de comercios con
 * domicilio y localidad, y solo se cargan las que tienen algún comercio en Mar del Plata.
 * Sus promos vía MODO las cubre el extractor de MODO.
 *
 * Las bases no informan fecha de fin (dicen "vigentes") y a veces el % depende de la adhesión del comercio:
 * nunca se supone, así que sin fecha de fin la promo queda activo:false para verificarla.
 */

const cheerio = require('cheerio');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'corrientes';
const BASE = 'https://promosdelbanco.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36' };
const EN_MDP = /mar del plata|general pueyrredon|batan\b/i;

async function auditarCorrientes() {
  console.log('[monitor-agent] Leyendo promos del Banco de Corrientes...');
  const hoy = C.hoyISO();
  const $ = cheerio.load(await C.fetchText(`${BASE}/`, { headers: UA }));
  const paginas = [...new Set($('a[href*="/promociones/"]').map((i, e) => $(e).attr('href').split('#')[0]).get())];
  console.log(`[monitor-agent] ${paginas.length} promos publicadas. Buscando comercios en Mar del Plata...`);

  const extraidas = [];
  const ignoradas = [];
  for (const url of paginas) {
    const p = cheerio.load(await C.fetchText(url, { headers: UA }).catch(() => ''));
    const filas = p('table tr').map((i, e) => [p(e).find('td').map((j, x) => p(x).text().replace(/\s+/g, ' ').trim()).get()]).get();
    const enMdP = filas.filter(f => EN_MDP.test(C.norm(f.join(' '))));
    const nombre = url.replace(/\/$/, '').split('/').pop();
    if (!enMdP.length) { ignoradas.push({ url, motivo: filas.length ? `Sin comercios en Mar del Plata (${filas.length - 1} en otras localidades)` : 'Sin tabla de comercios' }); continue; }

    const texto = p('body').text().replace(/\s+/g, ' ');
    const bases = texto.slice(Math.max(0, texto.search(/LOS D[IÍ]AS|VIGENTE/i)), texto.search(/DENOMINACI[OÓ]N/i));
    const pctM = /(?:bonificaci[oó]n del|se bonificar[aá] el)\s+(\d{1,2})\s?%/i.exec(bases);
    if (!pctM) { ignoradas.push({ url, motivo: 'Sin reintegro porcentual (solo cuotas)' }); continue; }
    const pct = +pctM[1];
    const dias = C.parseDias((/los d[ií]as ([a-záéíóú ,y]+?)[:.,]/i.exec(bases) || [])[1] || '') || [];
    const tope = C.parseTope(bases);
    const vig = C.parseVigenciaTexto(bases);
    const desde = (enMdP[0][3] || '').split('/');
    const vigenciaDesde = desde.length === 3 ? `${desde[2]}-${desde[0].padStart(2, '0')}-${desde[1].padStart(2, '0')}` : hoy;

    const motivos = [];
    if (!vig || !vig.hasta) motivos.push('Las bases no informan fecha de fin ("vigentes"): verificar antes de activar.');
    if (!tope) motivos.push('Las bases no mencionan tope.');
    if (/dependiendo de la adhesi[oó]n/i.test(bases)) motivos.push(`El ${pct}% depende de la modalidad a la que adhirió cada comercio (en la tabla figura con ${enMdP[0][5] || '?'} cuotas).`);
    if (!dias.length) motivos.push('No se pudieron leer los días.');
    const soloBilletera = /billetera m[aá]s banco/i.test(bases);
    const comercios = [...new Set(enMdP.map(f => f[0]))];

    extraidas.push({
      id: `ctes-${nombre}`,
      bancoBilleteraId: 'banco-corrientes',
      bancoBilleteraNombre: 'Banco de Corrientes',
      tipoMedioRequerido: /d[eé]bito/i.test(bases) && /cr[eé]dito/i.test(bases) ? 'cualquiera' : /d[eé]bito/i.test(bases) ? 'debito' : 'credito',
      medioPagoDetalle: soloBilletera ? 'Tarjetas Visa y Mastercard del Banco de Corrientes desde la billetera Más BanCo' : 'Tarjetas Visa y Mastercard del Banco de Corrientes',
      rubro: /hogar|electro|fravega|garbarino/i.test(nombre + comercios.join(' ')) ? 'hogar' : /farmac/i.test(nombre) ? 'farmacia' : /super/i.test(nombre) ? 'supermercado' : /servicio|combust/i.test(nombre) ? 'combustible' : 'otros',
      diasSemana: dias,
      diasTexto: C.diasATexto(dias),
      vigenciaDesde,
      vigenciaHasta: (vig && vig.hasta) || C.hoyISO(new Date(new Date(hoy).getFullYear(), new Date(hoy).getMonth() + 1, 0)),
      porcentajeDescuento: pct,
      tipoTope: tope && tope.tipoTope ? tope.tipoTope : 'sin_tope',
      montoTope: tope && tope.montoTope ? tope.montoTope : null,
      minimoCompra: C.parseMinimo(bases),
      montoGastoOptimo: C.gastoOptimo(tope && tope.montoTope, pct),
      condicionUso: soloBilletera ? 'Pagar con la billetera Más BanCo eligiendo una tarjeta del Banco de Corrientes (no vale con otras billeteras).' : 'Pagar con tarjeta del Banco de Corrientes.',
      localesAdheridos: comercios.slice(0, 3).join(', ') + (comercios.length > 3 ? ` y ${comercios.length - 3} más` : ''),
      aclaraciones: `Comercios en Mar del Plata: ${enMdP.map(f => `${f[0]} (${f[1]})`).join('; ')}.${motivos.length ? ' REVISAR: ' + motivos.join(' ') : ''}`,
      fuenteUrl: url,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
    });
  }

  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'Banco de Corrientes',
    bancoIds: ['banco-corrientes'],
    extraidas,
    ignoradas,
    filtroCatalogo: p => p.fuenteId === FUENTE_ID,
  });
}

auditarCorrientes().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Banco de Corrientes:', err);
  process.exit(1);
});
