/**
 * Monitor Agent: Extractor y Auditor de Naranja X
 * Fuente pública: https://www.naranjax.com/promociones
 *
 * La web es una SPA Angular. Se probó Playwright: Cloudflare lo bloquea y devuelve una página de
 * mantenimiento ("Estamos trabajando para volver pronto"), así que se consume directo el BFF JSON que usa
 * la propia app (identificado con DevTools > Network en el navegador integrado):
 *   GET  /bff-promotions-web/api/data-for-filter              categorías y días
 *   POST /bff-promotions-web/api/binder/filter                listado por categoría (+ geoposición)
 *   POST /bff-promotions-web/api/binder/{comercio}            planes del comercio
 *   POST /bff-promotions-web/api/binder/{comercio}/detail/{plan}   legal, tope, vigencia
 *
 * Alcance y reglas:
 *  - Solo planes con DESCUENTO % (las "cuotas cero interés" no son un reintegro y se ignoran).
 *  - Los planes "Exclusiva Turbo" (requieren el Plan Turbo pago de Naranja X) se ignoran.
 *  - La API no informa sucursales, así que la presencia en Mar del Plata no es verificable desde la fuente:
 *    solo se activan cadenas de presencia nacional conocida (C.PRESENCIA_MDP); el resto queda inactivo.
 *  - El texto LEGAL manda sobre los "tags" (ej. el tag decía "por mes" y el legal "por semana").
 *  - Nada se completa por defecto: sin tope/vigencia verificable => activo:false + nota.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'naranjax';
const API = 'https://bkn-promotions.naranjax.com/bff-promotions-web/api';
const WEB = 'https://www.naranjax.com/promociones';
const MDP = { latitude: -38.00042, longitude: -57.5562 };
const PAUSA_MS = 80;

// Cloudflare acepta estas cabeceras (imitan a la web); sin Origin/Referer devuelve 403
const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Origin: 'https://www.naranjax.com',
  Referer: 'https://www.naranjax.com/',
};

const RUBRO = {
  SUPERMERCADOS: 'supermercado', GASTRONOMIA: 'gastronomia', COMBUSTIBLE: 'combustible',
  MODA_Y_ACCESORIOS: 'indumentaria', ELECTRO_Y_TECNOLOGIA: 'tecnologia', HOGAR_Y_DECO: 'hogar',
  CONSTRUCCION: 'hogar', ENTRETENIMIENTO: 'entretenimiento',
};
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function post(ruta, body) {
  await dormir(PAUSA_MS);
  return C.fetchJson(`${API}${ruta}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
}
const geoFiltro = { latitude: String(MDP.latitude), longitude: String(MDP.longitude), zoom: '30km' };
const geoDetalle = { payload: { latitude: MDP.latitude, longitude: MDP.longitude, province: 'Mar del Plata', locality: '' } };

const fechaDMY = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const dia7a0 = n => (n === 7 ? 0 : n); // la API usa 1=lunes..7=domingo

async function auditarNaranjaX() {
  console.log('[monitor-agent] Consultando API de Naranja X...');
  const hoy = C.hoyISO();
  const filtros = await C.fetchJson(`${API}/data-for-filter`, { headers: HEADERS });
  const categorias = (filtros.categories || []).filter(c => c.active);

  // 1) Comercios por categoría
  const comercios = new Map();
  for (const cat of categorias) {
    for (let page = 1; page < 30; page++) {
      const j = await post('/binder/filter', { filters: { categories: [{ key: cat.key }], geoposition: geoFiltro }, pageOptions: { page, size: 50 } });
      const lista = j.data || [];
      lista.forEach(b => { if (!comercios.has(b.url)) comercios.set(b.url, { ...b, _cat: cat }); });
      if (lista.length < 50) break;
    }
    console.log(` -> ${cat.name}: ${[...comercios.values()].filter(b => b._cat.key === cat.key).length} comercios`);
  }

  const extraidas = [];
  const ignoradas = [];

  // 2) Planes con descuento % de cada comercio
  for (const com of comercios.values()) {
    let b;
    try {
      b = await post(`/binder/${com.url}`, geoDetalle);
    } catch (e) {
      ignoradas.push({ comercio: com.commerceName, motivo: `No se pudo leer el comercio: ${e.message}` });
      continue;
    }
    const planes = [...(b.nearCurrent || []), ...(b.current || []), ...(b.active || [])];
    for (const plan of planes) {
      const pct = Number((plan.benefit && plan.benefit.discountPercentage) || 0);
      if (!pct) continue; // cuotas / otros beneficios
      const nombre = b.commerceName || com.commerceName;

      if (plan.ephemeris && /turbo/i.test(plan.ephemeris.description || '')) {
        ignoradas.push({ comercio: nombre, plan: plan.url, motivo: `Exclusiva Plan Turbo (${pct}%): requiere el plan pago de Naranja X` });
        continue;
      }

      let d;
      try {
        d = await post(`/binder/${com.url}/detail/${plan.url}`, geoDetalle);
      } catch (e) {
        ignoradas.push({ comercio: nombre, plan: plan.url, motivo: `No se pudo leer el detalle: ${e.message}` });
        continue;
      }
      const pd = d.promotionDetails || {};
      const legal = d.legal || '';
      const motivos = [];
      const notas = [];

      const dias = (d.days && d.days.weekdaysApplied || []).map(dia7a0).sort();
      if (!dias.length) motivos.push('La API no informa días de aplicación.');
      const desde = fechaDMY(d.days && d.days.dateFrom);
      const hasta = fechaDMY(d.days && d.days.dateTo);
      if (!hasta) motivos.push('Sin fecha de vigencia.');

      // Tope: el legal manda; luego refundLimit + renewalType; luego el tag "Sin tope"
      let tipoTope = null;
      let montoTope = null;
      const tLegal = C.parseTope(legal);
      const RENOV = { weekly: 'por_semana', monthly: 'por_mes', daily: 'por_dia' };
      const tagTope = (d.tags || []).find(t => t.type === 'refund');
      if (tLegal && tLegal.tipoTope === 'sin_tope') tipoTope = 'sin_tope';
      else if (tLegal && tLegal.tipoTope && tLegal.montoTope) { tipoTope = tLegal.tipoTope; montoTope = tLegal.montoTope; }
      else if (Number(pd.refundLimit) > 0 && RENOV[pd.renewalType]) { tipoTope = RENOV[pd.renewalType]; montoTope = Number(pd.refundLimit); }
      else if (tagTope && /sin tope/i.test(tagTope.description)) tipoTope = 'sin_tope';
      else if (tagTope && (() => { const t = C.parseTope(`Tope ${tagTope.description}`); if (t && t.tipoTope && t.montoTope) { tipoTope = t.tipoTope; montoTope = t.montoTope; return true; } return false; })()) { /* tope tomado del tag (ej. "$ 20.000, por transacción") */ }
      else motivos.push(`No se pudo verificar el tope (tag: "${tagTope ? tagTope.description : '-'}").`);
      if (tipoTope && tipoTope !== 'sin_tope' && tagTope && RENOV[pd.renewalType] && tipoTope !== RENOV[pd.renewalType]) {
        notas.push(`Ojo: el tag dice "${tagTope.description}" pero el legal indica ${tipoTope.replace('por_', 'por ')}; se usa el legal.`);
      }

      const minimo = pd.forPurchasesOver ? Number(pd.forPurchasesOver) : C.parseMinimo(legal);

      // Medios
      const pm = d.paymentMethods || plan.paymentMethods || [];
      const cred = pm.includes('credito');
      const deb = pm.includes('debito');
      const dinero = pm.includes('dinero');
      if (!pm.length) motivos.push('La API no informa medios de pago.');
      const qr = (d.captureMethods || []).some(c => c.key === 'qr');
      const partes = [];
      if (cred && deb) partes.push('Tarjeta de crédito y débito Naranja X');
      else if (cred) partes.push('Tarjeta de crédito Naranja X');
      else if (deb) partes.push('Tarjeta de débito Naranja X');
      if (dinero) partes.push(`Dinero en cuenta Naranja X${qr ? ' pagando con QR desde la app' : ''}`);
      const medio = partes.join(' o ') || 'Medio de pago Naranja X';
      const tipoMedio = (cred || deb) && dinero ? 'cualquiera' : cred && deb ? 'cualquiera' : cred ? 'credito' : deb ? 'debito' : 'cuenta';

      if (pd.appliesInStore === false) notas.push('Solo online.');
      if (pd.validOnSelectedProducts) notas.push('Válida en productos seleccionados (ver exclusiones del legal).');

      if (!C.PRESENCIA_MDP.test(C.norm(nombre))) {
        motivos.push('Presencia en Mar del Plata no confirmada (la fuente no informa sucursales; comercio regional/local): verificar a mano.');
      }

      extraidas.push({
        id: `nx-${C.slugify(com.url)}-${C.slugify(plan.url)}`.slice(0, 90),
        bancoBilleteraId: 'naranja-x',
        bancoBilleteraNombre: 'Naranja X',
        tipoMedioRequerido: tipoMedio,
        medioPagoDetalle: medio,
        rubro: /farmac|perfumer|simplicity|juleriaque|get the look/i.test(nombre) ? 'farmacia' : (RUBRO[com._cat.key] || 'otros'),
        diasSemana: dias,
        diasTexto: C.diasATexto(dias),
        vigenciaDesde: desde || hoy,
        vigenciaHasta: hasta || hoy,
        porcentajeDescuento: pct,
        tipoTope: tipoTope || 'sin_tope',
        montoTope,
        minimoCompra: minimo || null,
        montoGastoOptimo: C.gastoOptimo(montoTope, pct),
        condicionUso: `Pagar en ${nombre} con ${medio}.`,
        localesAdheridos: nombre,
        aclaraciones: [
          `${pct}% de descuento ${dias.length ? C.diasATexto(dias).toLowerCase() : ''} en ${nombre}.`,
          tipoTope === 'sin_tope' ? 'Sin tope.' : montoTope ? `Tope $${montoTope.toLocaleString('es-AR')} ${tipoTope.replace('por_', 'por ')}.` : '',
          minimo ? `Mínimo de compra $${minimo.toLocaleString('es-AR')}.` : '',
          ...notas,
          motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
        ].filter(Boolean).join(' '),
        fuenteUrl: `${WEB}/${com._cat.key}/${(com.category && com.category.subcategory && com.category.subcategory.key) || ''}/${com.url}/${plan.url}`.replace(/\/{2,}/g, '/').replace('https:/', 'https://'),
        fuenteId: FUENTE_ID,
        ultimaVerificacion: hoy,
        activo: motivos.length === 0,
        _meta: { categoria: com._cat.name, appliesInStore: pd.appliesInStore, appliesOnline: pd.appliesOnline },
      });
    }
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Naranja X', bancoIds: ['naranja-x'], extraidas, ignoradas });
}

auditarNaranjaX().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Naranja X:', err);
  process.exit(1);
});
