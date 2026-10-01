/**
 * Monitor Agent: Extractor y Auditor de Mercado Pago (vía las páginas oficiales de los comercios)
 *
 * Mercado Pago NO publica sus beneficios en locales en ninguna web pública: viven solo en la app ("Beneficios"),
 * dependen de la ubicación y requieren sesión. La web promociones.mercadopago.com.ar está abandonada (Hot Sale de
 * mayo, solo tiendas online), así que dejó de usarse.
 *
 * Fuente automática: las páginas de "descuentos bancarios" de cadenas con locales en Mar del Plata, que publican
 * las promos de Mercado Pago con sus bases ("Ver legal"):
 *   - Carrefour  https://www.carrefour.com.ar/descuentos-bancarios   (se renderiza con JS: Playwright)
 *   - ChangoMás  https://www.masonline.com.ar/promociones-bancarias
 * Se toman los bloques que mencionan Mercado Pago y tienen descuento porcentual; las de solo cuotas se ignoran.
 * Vigencia, días y tope salen SIEMPRE de las bases; si falta alguno, activo:false (nunca se supone).
 *
 * Fuente manual (sources.json "mercadopago-app"): capturas de la app con la ubicación en Mar del Plata, el día 1.
 * Esas promos (ids mp-*) no las toca este script.
 */

const { chromium } = require('playwright');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'mercadopago';
const COMERCIOS = [
  { nombre: 'Carrefour', url: 'https://www.carrefour.com.ar/descuentos-bancarios', rubro: 'supermercado' },
  { nombre: 'ChangoMás', url: 'https://www.masonline.com.ar/promociones-bancarias', rubro: 'supermercado' },
];

/** Texto de la página separado en tarjetas: [resumen visible, bases] por cada "Ver legal". */
function tarjetas(texto) {
  const partes = texto.split(/\s*Ver legal\s*/i);
  const out = [];
  for (let i = 0; i < partes.length - 1; i++) {
    // Las bases van en mayúsculas: el resumen de la tarjeta siguiente arranca donde termina ese bloque
    // Lo que quedó en mayúsculas al principio es la cola de las bases anteriores: se saltea
    const resumen = partes[i].slice(-400).replace(/^[^a-záéíóúñ]*(?=[A-ZÁÉÍÓÚÑ][a-záéíóúñ])/, '').trim();
    const bases = (partes[i + 1].match(/^[^a-z]+/) || [partes[i + 1].slice(0, 1500)])[0].trim();
    out.push({ resumen, bases });
  }
  return out;
}

async function auditarMercadoPago() {
  console.log('[monitor-agent] Buscando promos de Mercado Pago en páginas oficiales de comercios...');
  const hoy = C.hoyISO();
  const extraidas = [];
  const ignoradas = [];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'es-AR', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' });
  try {
    for (const com of COMERCIOS) {
      const page = await ctx.newPage();
      let texto = '';
      try {
        await page.goto(com.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(6000);
        texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      } catch (e) {
        ignoradas.push({ comercio: com.nombre, motivo: `No se pudo leer la página: ${e.message.split('\n')[0]}` });
        await page.close();
        continue;
      }
      await page.close();

      // Es de Mercado Pago si el resumen lo nombra o las bases dicen que se paga con MP. Las de otros bancos que
      // solo lo excluyen ("no aplica… con QR de Mercado Pago") no cuentan
      const pagaConMP = /pagos realizados a trav[eé]s del servicio de procesamiento de pagos de mercado ?pago|pagando con (?:el )?qr de mercado ?pago|con la app de mercado ?pago/i;
      const deMP = tarjetas(texto).filter(t => /mercado ?pago/i.test(t.resumen) || pagaConMP.test(t.bases));
      console.log(`[monitor-agent] ${com.nombre}: ${deMP.length} tarjetas con Mercado Pago.`);
      for (const t of deMP) {
        const todo = `${t.resumen} ${t.bases}`;
        const pctM = /(\d{1,2})\s?%\s*(?:de\s+)?(?:descuento|reintegro|ahorro|off)/i.exec(todo);
        if (!pctM) { ignoradas.push({ comercio: com.nombre, motivo: `Solo cuotas u otro beneficio: "${t.resumen.slice(-120)}"` }); continue; }
        const pct = +pctM[1];
        const vig = C.parseVigenciaTexto(t.bases);
        if (vig && vig.hasta && vig.hasta < hoy) { ignoradas.push({ comercio: com.nombre, motivo: `Vencida el ${vig.hasta}` }); continue; }
        const dias = C.parseDias(t.bases) || C.parseDias(t.resumen);
        const tope = C.parseTope(t.bases);
        const motivos = [];
        if (!vig || !vig.hasta) motivos.push('Vigencia no interpretable en las bases.');
        if (!dias || !dias.length) motivos.push('Días no interpretables.');
        if (!tope || (tope.tipoTope !== 'sin_tope' && !tope.tipoTope)) motivos.push('Tope no verificable en las bases.');
        const qr = /qr/i.test(todo);
        const credito = /tarjeta de cr[eé]dito (?:de )?mercado ?pago/i.test(todo);
        const cuenta = /dinero en cuenta/i.test(todo);
        extraidas.push({
          id: `mp-com-${C.slugify(com.nombre)}-${(dias || []).join('')}-${pct}`,
          bancoBilleteraId: 'mercado-pago',
          bancoBilleteraNombre: 'Mercado Pago',
          tipoMedioRequerido: credito ? 'credito' : cuenta ? 'cuenta' : 'cualquiera',
          medioPagoDetalle: `${qr ? 'QR de Mercado Pago' : 'Mercado Pago'}${credito ? ' con la Tarjeta de Crédito Mercado Pago' : cuenta ? ' con dinero en cuenta' : ''}`,
          rubro: com.rubro,
          diasSemana: dias || [],
          diasTexto: C.diasATexto(dias || []),
          vigenciaDesde: (vig && vig.desde) || hoy,
          vigenciaHasta: (vig && vig.hasta) || hoy,
          porcentajeDescuento: pct,
          tipoTope: tope && tope.tipoTope ? tope.tipoTope : 'sin_tope',
          montoTope: tope && tope.montoTope ? tope.montoTope : null,
          minimoCompra: C.parseMinimo(t.bases) || C.parseMinimo(t.resumen),
          montoGastoOptimo: C.gastoOptimo(tope && tope.montoTope, pct),
          condicionUso: `Pagar en ${com.nombre} escaneando el QR con la app de Mercado Pago.`,
          localesAdheridos: com.nombre,
          aclaraciones: `Publicado por ${com.nombre}: ${t.resumen.slice(-160)}.${motivos.length ? ' REVISAR: ' + motivos.join(' ') : ''}`,
          fuenteUrl: com.url,
          fuenteId: FUENTE_ID,
          ultimaVerificacion: hoy,
          activo: motivos.length === 0,
        });
      }
    }
  } finally {
    await browser.close();
  }

  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'Mercado Pago (páginas de comercios)',
    bancoIds: [],
    extraidas,
    ignoradas,
    // Solo las promos de esta fuente (las de la app son manuales y no se auditan acá)
    filtroCatalogo: p => p.fuenteId === FUENTE_ID,
  });
}

auditarMercadoPago().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Mercado Pago:', err);
  process.exit(1);
});
