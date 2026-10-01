/**
 * Monitor Agent: Extractor y Auditor de Cuenta DNI (Banco Provincia)
 * Fuente: https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/
 *
 * Método (estático + API oficial de detalle):
 *  1. Fetch del listado -> cards `.callModalCDNI` (título, días, % de cabecera).
 *  2. Por cada card, GetBeneficioData2?idBeneficio=<id> -> texto legal, bajada y condiciones.
 *  3. Del texto legal se parsea: vigencia real, variantes numeradas ("1- 15% ... dinero en cuenta",
 *     "2- 20% ... NFC"), tope y período del tope, mínimo de compra.
 *
 * Reglas:
 *  - Rubro y comercios salen de CARDS (configuración explícita); una card desconocida se reporta
 *    como nueva pero INACTIVA hasta que el data-agent la clasifique.
 *  - Nunca se completa un dato dudoso: sin vigencia/tope verificables => activo:false + nota.
 *  - No modifica promos.json: genera scripts/reports/cuentadni-{extract,report}.json
 */

const cheerio = require('cheerio');
const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'cuentadni';
const BASE_URL = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/';
const DETAIL_API_URL = 'https://www.bancoprovincia.com.ar/cuentadni/Home/GetBeneficioData2?idBeneficio=';

const MEDIO = {
  cuenta: 'Dinero en cuenta vía QR o Clave DNI',
  cuentaSoloClave: 'Dinero en cuenta vía Clave DNI (no aplica QR)',
  nfcCredito: 'Visa Crédito vía NFC en app Cuenta DNI (Android)',
  nfcCreditoDebito: 'Visa Crédito o Débito vía NFC en app Cuenta DNI (Android)',
};

/**
 * Configuración por card (clave = id de la card sin el número final).
 * `ids` mapea a los ids que ya existen en promos.json para no perder el historial/tests.
 * `inactiva` fuerza activo:false con el motivo (promo real pero no aplicable/verificable para Mar del Plata).
 */
const CARDS = {
  beneficio_librerias: { rubro: 'libreria', locales: 'Librerías de texto adheridas', ids: { default: 'cdni-librerias-lun-mar' } },
  comerciosdebarrio: { rubro: 'supermercado', locales: 'Comercios de cercanía, almacenes y tiendas de barrio (excluye garrafas, pet shops, veterinarias y gastronomía)', ids: { default: 'cdni-comercios-cercania' } },
  supermercados_martesymiercoles: { rubro: 'supermercado', locales: 'Supermercados adheridos participantes', ids: { default: 'cdni-super-cadenas-mar-mie' } },
  carrefour: { rubro: 'supermercado', locales: 'Carrefour (Hiper, Market, Express, Maxi; no incluye Digital)', ids: { default: 'cdni-super-carrefour-mie' } },
  laanonima: { rubro: 'supermercado', locales: 'Supermercados La Anónima', ids: { default: 'cdni-super-laanonima-mie' } },
  josimar: { rubro: 'supermercado', locales: 'Supermercados Josimar', ids: { default: 'cdni-super-josimar-mie' } },
  sodimac: { rubro: 'hogar', locales: 'Sodimac', ids: { default: 'cdni-hogar-sodimac-mie' } },
  farmaciasyperfumerias: { rubro: 'farmacia', locales: 'Farmacias y perfumerías adheridas', ids: { default: 'cdni-farmacia-mie-jue' } },
  toledo: { rubro: 'supermercado', locales: 'Supermercados Toledo y Mini Toledo', ids: { cuenta: 'cdni-super-toledo-cuenta', nfc: 'cdni-super-toledo-nfc' } },
  mostaza: { rubro: 'gastronomia', locales: 'Mostaza', ids: { cuenta: 'cdni-gastro-mostaza-cuenta', nfc: 'cdni-gastro-mostaza-nfc' } },
  changomas: { rubro: 'supermercado', locales: 'Hiper ChangoMás, ChangoMás y MásGo', ids: { default: 'cdni-super-changomas-jue' } },
  supercoop: { rubro: 'supermercado', locales: 'Supermercados Supercoop', soloClaveDNI: true, ids: { default: 'cdni-super-supercoop-vie-sab' } },
  especialypf: { rubro: 'gastronomia', locales: 'Gastronomía de tiendas YPF Full', ids: { default: 'cdni-gastro-finde' } },
  garrafas: { rubro: 'hogar', locales: 'Distribuidoras y puntos de venta o entrega de garrafas', ids: { default: 'cdni-hogar-garrafas' } },
  beneficiouniversidades: { rubro: 'otros', locales: 'Buffets, fotocopiadoras y comercios en universidades', ids: { default: 'cdni-universidades' } },
  feriasymercados: { rubro: 'supermercado', locales: 'Ferias y Mercados Bonaerenses identificados', ids: { default: 'cdni-ferias-mercados' } },
  cooperativaobrera: {
    rubro: 'supermercado', locales: 'Cooperativa Obrera (solo sucursales de Lobos y La Plata)', soloClaveDNI: true,
    inactiva: 'Exclusiva de las localidades de Lobos y La Plata; no aplica en Mar del Plata.',
  },
  marcasdestacadas: {
    rubro: 'otros', locales: 'Marcas destacadas adheridas',
    inactiva: 'La fuente no publica la nómina de marcas adheridas en el detalle; no se puede confirmar en qué comercios aplica. Revisar la nómina en la web oficial.',
  },
  especiallocalidades: {
    rubro: 'otros', locales: 'Comercios de localidades específicas',
    inactiva: 'Promo por localidad: la fuente no indica cuáles y el tope es "por vigencia" (período no soportado por el esquema). No verificable para Mar del Plata.',
  },
};

/** Cards que no son un descuento en % (se ignoran a propósito y se reportan). */
const IGNORAR = {
  tarjeteaconcuentadni: 'Cuotas sin interés con tarjeta de crédito Banco Provincia (no es un reintegro %).',
};

function parseFechaCard(detalle) {
  return { desde: C.fechaDotNet(detalle.fecha_desde), hasta: C.fechaDotNet(detalle.fecha_hasta) };
}

/** Divide el texto legal en cláusulas numeradas: "1- 15% DE REINTEGRO ... 2- 20% DE REINTEGRO ..." */
function dividirClausulas(legal) {
  const re = /(?:^|[\s.])([1-9])\s*-\s*(\d{1,3})\s*%\s*de\s*(?:reintegro|descuento|ahorro)/gi;
  const hitos = [];
  let m;
  while ((m = re.exec(legal))) hitos.push({ pos: m.index, pct: +m[2] });
  if (hitos.length < 2) return null;
  return hitos.map((h, i) => ({ pct: h.pct, texto: legal.slice(h.pos, i + 1 < hitos.length ? hitos[i + 1].pos : undefined) }));
}

function medioDeClausula(texto) {
  const t = C.norm(texto);
  if (/nfc|sin contacto/.test(t)) {
    return /debito/.test(t.slice(0, 500)) && /credito/.test(t.slice(0, 500)) ? 'nfcCreditoDebito' : 'nfcCredito';
  }
  return 'cuenta';
}

function construirVariantes(card, cfg, detalle) {
  const legal = detalle.legal || '';
  const bajada = detalle.bajada || '';
  const clausulas = dividirClausulas(legal);

  const base = clausulas
    ? clausulas.map(cl => {
        const medio = medioDeClausula(cl.texto);
        const tope = C.parseTope(cl.texto);
        return { pct: cl.pct, medio, tope, minimo: C.parseMinimo(cl.texto) ?? C.parseMinimo(bajada), texto: cl.texto };
      })
    : [{
        pct: card.pct,
        medio: 'cuenta',
        // La bajada es lo que la propia fuente destaca; el legal solo desempata
        tope: C.parseTope(bajada) || C.parseTope(legal.slice(0, 1200)),
        minimo: C.parseMinimo(bajada) ?? C.parseMinimo(legal.slice(0, 1200)),
        texto: legal,
      }];

  // Variantes con el mismo % y tope => una sola promo (no hay diferencia para el usuario)
  const firma = v => `${v.pct}|${JSON.stringify(v.tope)}|${v.minimo}`;
  if (base.length > 1 && base.every(v => firma(v) === firma(base[0]))) {
    return [{ ...base[0], medio: 'cuenta', fusionada: true }];
  }
  return base;
}

async function auditarCuentaDNI() {
  console.log('[monitor-agent] Conectando con Cuenta DNI...');
  const hoy = C.hoyISO();
  const html = await C.fetchText(BASE_URL);
  const $ = cheerio.load(html);
  const cards = $('.callModalCDNI').toArray();
  console.log(`[monitor-agent] ${cards.length} cards de beneficios en el listado.`);

  const extraidas = [];
  const ignoradas = [];

  for (const el of cards) {
    const rawId = $(el).attr('id') || '';
    const idNum = (rawId.match(/(\d+)$/) || [])[1];
    const slug = rawId.replace(/-\d+$/, '');
    const card = {
      titulo: $(el).find('.tituloBeneficio').text().replace(/\s+/g, ' ').trim(),
      diasTexto: $(el).find('.BEN_CON_dias').text().replace(/\s+/g, ' ').trim(),
      pct: parseInt($(el).find('.BEN_CON_nro').text().trim(), 10) || null,
    };

    if (IGNORAR[slug]) {
      ignoradas.push({ card: rawId, titulo: card.titulo, motivo: IGNORAR[slug] });
      continue;
    }
    if (!idNum || !card.pct) {
      ignoradas.push({ card: rawId, titulo: card.titulo, motivo: 'Card sin id o sin porcentaje legible' });
      continue;
    }

    let detalle = null;
    try {
      const data = await C.fetchJson(`${DETAIL_API_URL}${idNum}`);
      detalle = data.Entity && data.Entity.Beneficio;
      if (detalle) detalle._condiciones = (data.Entity.Condiciones || []).map(c => c.texto);
    } catch (e) {
      console.warn(`  ! Sin detalle para ${rawId}: ${e.message}`);
    }

    const cfg = CARDS[slug];
    const advertencias = [];
    const motivosInactiva = [];
    if (!cfg) motivosInactiva.push(`Card nueva "${card.titulo}" sin clasificar (rubro y comercios): requiere revisión del data-agent.`);
    if (cfg && cfg.inactiva) motivosInactiva.push(cfg.inactiva);
    if (!detalle) motivosInactiva.push('No se pudo obtener el detalle oficial (tope, vigencia y condiciones sin verificar).');

    const dias = C.parseDias(detalle ? detalle.titulo_fecha : card.diasTexto) || C.parseDias(card.diasTexto);
    if (!dias) motivosInactiva.push('No se pudieron determinar los días de vigencia.');

    // Vigencia: el texto legal manda; el metadato de la API solo sirve de respaldo/contraste (viene con ±1 día)
    let vig = detalle ? C.parseVigenciaTexto(detalle.legal) : null;
    if (detalle) {
      const meta = parseFechaCard(detalle);
      if (vig && meta.hasta && Math.abs((new Date(vig.hasta) - new Date(meta.hasta)) / 86400000) > 3) {
        advertencias.push(`Vigencia del texto legal (${vig.hasta}) difiere del metadato de la API (${meta.hasta}).`);
      }
      if (!vig && meta.desde && meta.hasta) {
        vig = { desde: meta.desde, hasta: meta.hasta, tipo: 'metadato-api' };
        advertencias.push('Vigencia tomada del metadato de la API (±1 día); el texto legal no la especifica.');
      }
    }
    if (!vig || !vig.hasta) motivosInactiva.push('No se pudo determinar la vigencia.');

    const variantes = detalle ? construirVariantes(card, cfg || {}, detalle) : [{ pct: card.pct, medio: 'cuenta', tope: null, minimo: null, texto: '' }];
    const dividida = variantes.length > 1;
    const baseId = (cfg && cfg.ids && cfg.ids.default) || `cdni-${slug.replace(/_/g, '-')}`;

    for (const v of variantes) {
      const motivos = [...motivosInactiva];
      let tipoTope = null;
      let montoTope = null;
      if (v.tope && v.tope.tipoTope === 'sin_tope') {
        tipoTope = 'sin_tope';
      } else if (v.tope && v.tope.tipoTope && v.tope.montoTope) {
        tipoTope = v.tope.tipoTope;
        montoTope = v.tope.montoTope;
      } else if (v.tope && v.tope.montoTope) {
        motivos.push(`Tope de $${v.tope.montoTope} con período no reconocido; no se asume.`);
      } else {
        motivos.push('No se pudo verificar el tope en el detalle oficial.');
      }

      const claveVariante = v.fusionada || !dividida ? 'default' : (v.medio === 'cuenta' ? 'cuenta' : 'nfc');
      const id = (cfg && cfg.ids && cfg.ids[claveVariante]) || (dividida ? `${baseId}-${claveVariante}` : baseId);
      const medioKey = v.medio === 'cuenta' && cfg && cfg.soloClaveDNI ? 'cuentaSoloClave' : v.medio;
      const medioDetalle = MEDIO[medioKey];
      const locales = cfg ? cfg.locales : card.titulo;

      const partesAcl = [];
      partesAcl.push(v.medio === 'cuenta' ? `${v.pct}% de reintegro con dinero en cuenta.` : `${v.pct}% de reintegro pagando con NFC desde la app (solo Android).`);
      if (tipoTope === 'sin_tope') partesAcl.push('Sin tope de reintegro.');
      else if (tipoTope) partesAcl.push(`Tope de $${montoTope.toLocaleString('es-AR')} (${tipoTope.replace('por_', 'por ')}).`);
      if (v.minimo) partesAcl.push(`Mínimo de compra $${v.minimo.toLocaleString('es-AR')}.`);
      if (v.fusionada) partesAcl.push('También aplica pagando con NFC (Visa Crédito, Android) al mismo porcentaje.');
      if (motivos.length) partesAcl.push(`REVISAR: ${motivos.join(' ')}`);
      if (advertencias.length) partesAcl.push(advertencias.join(' '));

      extraidas.push({
        id,
        bancoBilleteraId: 'cuenta-dni',
        bancoBilleteraNombre: 'Cuenta DNI',
        tipoMedioRequerido: v.medio === 'cuenta' ? 'cuenta' : (v.medio === 'nfcCreditoDebito' ? 'cualquiera' : 'credito'),
        medioPagoDetalle: medioDetalle,
        rubro: cfg ? cfg.rubro : 'otros',
        diasSemana: dias || [],
        diasTexto: C.diasATexto(dias),
        vigenciaDesde: (vig && vig.desde) || hoy,
        vigenciaHasta: (vig && vig.hasta) || hoy,
        porcentajeDescuento: v.pct,
        tipoTope: tipoTope || 'sin_tope',
        montoTope,
        minimoCompra: v.minimo || null,
        montoGastoOptimo: C.gastoOptimo(montoTope, v.pct),
        condicionUso: `Pagar de manera presencial en ${locales} con ${medioDetalle}.`,
        localesAdheridos: locales,
        aclaraciones: partesAcl.join(' '),
        fuenteUrl: BASE_URL,
        fuenteId: FUENTE_ID,
        ultimaVerificacion: hoy,
        activo: motivos.length === 0,
        _meta: { card: rawId, vigenciaOrigen: vig && vig.tipo, advertencias, variantes: variantes.length },
      });
    }
    console.log(` -> ${rawId}: ${variantes.map(v => v.pct + '%').join(' / ')} | ${C.diasATexto(dias)} | hasta ${vig && vig.hasta}${motivosInactiva.length ? ' [INACTIVA]' : ''}`);
  }

  generarReporte({
    fuenteId: FUENTE_ID,
    fuenteNombre: 'Cuenta DNI',
    bancoIds: ['cuenta-dni'],
    extraidas,
    ignoradas,
  });
}

auditarCuentaDNI().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Cuenta DNI:', err);
  process.exit(1);
});
