/**
 * Monitor Agent: Extractor y Auditor de Banco Supervielle
 * Fuente: https://www.supervielle.com.ar/personas/beneficios/descuentos
 *
 * El listado principal carga con spinner, pero SÍ son estáticas (SSR) las sub-páginas por rubro y por tipo
 * de cliente: el HTML trae `__NEXT_DATA__ = {...}` con `pageProps.beneficios`. Por eso alcanza con fetch:
 *   /personas/beneficios/descuentos/<rubro>            -> nivel Clásico (Cartera General)
 *   /personas/beneficios/descuentos/<rubro>/identite   -> nivel Identité
 *   /personas/beneficios/detalle/<id>                  -> legales (período del tope, mínimo, provincias)
 * No hace falta Playwright.
 *
 * Reglas:
 *  - Se guardan los 2 niveles (Clásico / Identité) en `niveles`; porcentajeDescuento = piso (Clásico).
 *  - Se ignoran "Plan Sueldo" y "Jubilados" (segmentos que no aplican a cualquier cliente).
 *  - Presencia en Mar del Plata: la fuente no informa sucursales por promo; se activan solo cadenas de
 *    presencia nacional (C.PRESENCIA_MDP) cuyo legal no limite la promo a otras provincias.
 *  - Nada por defecto: sin tope/período/vigencia verificable => activo:false + nota.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'supervielle';
const ORIGEN = 'https://www.supervielle.com.ar';
const BASE = `${ORIGEN}/personas/beneficios/descuentos`;

/** Rubros de Supervielle que son regionales/estacionales y no aplican a Mar del Plata. */
const RUBROS_EXCLUIDOS = {
  'carnicerias-mendoza': 'Rubro exclusivo de Mendoza',
  'carnicerias-san-luis': 'Rubro exclusivo de San Luis',
  'invierno-en-chile': 'Promos de viaje a Chile',
};
const RUBRO = {
  supermercados: 'supermercado', combustible: 'combustible', farmacia: 'farmacia', restaurantes: 'gastronomia',
  indumentaria: 'indumentaria', hogar: 'hogar', mascotas: 'mascotas', tecnologia: 'tecnologia', entretenimiento: 'entretenimiento',
};
const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const OTRAS_PROVINCIAS = /neuqu[eé]n|mendoza|entre r[ií]os|santa fe|c[oó]rdoba|tucum[aá]n|salta|jujuy|san luis|san juan|r[ií]o negro|chubut|misiones|corrientes|chaco/i;

function extraerNextData(html) {
  const i = html.indexOf('__NEXT_DATA__ = ');
  if (i < 0) return null;
  const j = html.indexOf('{', i);
  let depth = 0, inStr = false, esc = false, k = j;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return JSON.parse(html.slice(j, k + 1));
}

async function pageProps(ruta) {
  const nd = extraerNextData(await C.fetchText(`${ORIGEN}${ruta}`));
  if (!nd) throw new Error(`Sin __NEXT_DATA__ en ${ruta}`);
  return nd.props.pageProps;
}

async function enPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch(e => ({ error: e.message })); }
  }));
  return out;
}

const parseDiasNombres = arr => [...new Set((arr || []).map(d => DIAS[C.norm(d)]).filter(d => d !== undefined))].sort();
const claveItem = it => `${C.norm(it.marca)}|${parseDiasNombres(it.dias).join('')}`;
const pctNum = s => { const m = /(\d{1,3})\s*%/.exec(String(s || '')); return m ? +m[1] : null; };

async function auditarSupervielle() {
  console.log('[monitor-agent] Consultando Supervielle (sub-páginas estáticas por rubro)...');
  const hoy = C.hoyISO();
  const base = await pageProps('/personas/beneficios/descuentos/supermercados');
  const rubros = (base.rubros || []).map(r => r.slug);

  const ignoradas = [];
  const rubrosActivos = rubros.filter(s => {
    if (RUBROS_EXCLUIDOS[s]) { ignoradas.push({ rubro: s, motivo: RUBROS_EXCLUIDOS[s] }); return false; }
    return true;
  });

  const paginas = await enPool(rubrosActivos, 4, async slug => ({
    slug,
    clasico: (await pageProps(`/personas/beneficios/descuentos/${slug}`)).beneficios || [],
    identite: (await pageProps(`/personas/beneficios/descuentos/${slug}/identite`)).beneficios || [],
  }));
  console.log(`[monitor-agent] ${paginas.reduce((n, p) => n + (p.clasico ? p.clasico.length : 0), 0)} beneficios (nivel Clásico) en ${rubrosActivos.length} rubros.`);

  // Candidatos: uno por (marca+días), con su versión Identité
  const candidatos = [];
  for (const pg of paginas) {
    if (pg.error) { ignoradas.push({ rubro: pg.slug, motivo: `No se pudo leer: ${pg.error}` }); continue; }
    const porClave = new Map(pg.identite.map(x => [claveItem(x), x]));
    for (const it of pg.clasico) {
      if (/plan sueldo|jubilad|haberes/i.test(it.marca)) { ignoradas.push({ marca: it.marca, rubro: pg.slug, motivo: 'Segmento Plan Sueldo / Jubilados: no aplica a cualquier cliente' }); continue; }
      const pct = pctNum(it.descuento);
      if (!pct) { ignoradas.push({ marca: it.marca, rubro: pg.slug, motivo: 'Sin porcentaje de descuento (solo cuotas u otro beneficio)' }); continue; }
      candidatos.push({ slug: pg.slug, it, idt: porClave.get(claveItem(it)) || null, pct });
    }
  }

  const extraidas = [];
  // Detalle (legales) solo de las cadenas con presencia nacional: son las únicas que pueden activarse
  const conPresencia = candidatos.filter(c => C.PRESENCIA_MDP.test(C.norm(c.it.marca)));
  const detalles = await enPool(conPresencia, 4, async c => {
    const pp = await pageProps(`/personas/beneficios/detalle/${c.it.id}`);
    return (pp.details && pp.details.legales) || (pp.data && pp.data.beneficio && pp.data.beneficio.legales) || '';
  });
  const legalDe = new Map(conPresencia.map((c, i) => [c.it.id, typeof detalles[i] === 'string' ? detalles[i] : '']));

  for (const c of candidatos) {
    const { it, idt, pct, slug } = c;
    const motivos = [];
    const notas = [];
    const legal = legalDe.get(it.id) || '';
    const tienePresencia = C.PRESENCIA_MDP.test(C.norm(it.marca));
    if (!tienePresencia) motivos.push('Presencia en Mar del Plata no confirmada (la fuente no informa sucursales; comercio regional/local): verificar a mano.');
    else if (!legal) motivos.push('No se pudo leer el legal de la promo.');

    // Alcance geográfico declarado en el legal
    if (legal) {
      const sucursales = /sucursales de [^.]{0,120}/i.exec(legal);
      if (sucursales && OTRAS_PROVINCIAS.test(sucursales[0]) && !/buenos aires/i.test(sucursales[0])) {
        motivos.push(`El legal limita la promo a otras provincias ("${sucursales[0].slice(0, 90)}").`);
      }
    }

    const dias = parseDiasNombres(it.dias);
    if (!dias.length) motivos.push('No se pudieron determinar los días.');
    if (!it.fechaVigenciaHasta) motivos.push('Sin fecha de vigencia.');

    // Tope: el período sale del legal ("tope mensual", "por semana"...)
    let tipoTope = null;
    let montoTope = null;
    if (legal) {
      const nl = C.norm(legal);
      if (/sin tope/.test(nl) && !it.tope) tipoTope = 'sin_tope';
      else if (it.tope) {
        montoTope = it.tope;
        if (/tope\s+mensual|por mes\b|mensual por (?:cuenta|cliente)/.test(nl)) tipoTope = 'por_mes';
        else if (/tope\s+semanal|por semana\b/.test(nl)) tipoTope = 'por_semana';
        else if (/tope\s+diario|por dia\b/.test(nl)) tipoTope = 'por_dia';
        else if (/por (?:compra|operacion|transaccion)/.test(nl)) tipoTope = 'por_compra';
        else { motivos.push(`Tope de $${it.tope} sin período reconocible en el legal; no se asume.`); montoTope = null; }
      } else motivos.push('La fuente no informa tope y el legal no dice "sin tope".');
    } else if (tienePresencia) {
      motivos.push('Sin legal: no se puede verificar el período del tope.');
    }
    const minimo = legal ? C.parseMinimo(legal) : null;

    // Niveles Clásico / Identité
    const niveles = [{ nivel: 'Clásico', porcentaje: pct, montoTope: it.tope || null }];
    if (idt && pctNum(idt.descuento)) niveles.push({ nivel: 'Identité', porcentaje: pctNum(idt.descuento), montoTope: idt.tope || null });
    else notas.push('No figura en el listado Identité: se toma solo el nivel Clásico.');
    const usarNiveles = niveles.length === 2 && (niveles[0].porcentaje !== niveles[1].porcentaje || niveles[0].montoTope !== niveles[1].montoTope);
    const piso = Math.min(...niveles.map(n => n.porcentaje));
    const topePiso = niveles.find(n => n.porcentaje === piso).montoTope;

    if (/acumulable con/i.test(legal)) notas.push('El legal indica que se acumula con otra campaña (ver legal).');
    if (/nfc/i.test(legal) && /no v[aá]lido para pagos efectuados con tecnolog[ií]a nfc/i.test(legal)) notas.push('No válido con pagos NFC (solo QR).');

    const cred = !!it.esTarjetaCredito;
    const deb = !!it.esTarjetaDebito;
    const medio = `${cred && deb ? 'Tarjetas de crédito y débito' : cred ? 'Tarjetas de crédito' : 'Tarjeta de débito'} Supervielle pagando con QR vía MODO desde la app Supervielle o MODO`;
    const nombre = it.marca.replace(/\s+con MODO\s*$/i, '').trim();

    extraidas.push({
      id: `sup-${C.slugify(it.marca)}-${dias.join('')}`.slice(0, 90),
      bancoBilleteraId: 'supervielle',
      bancoBilleteraNombre: 'Banco Supervielle',
      tipoMedioRequerido: cred && deb ? 'cualquiera' : cred ? 'credito' : 'debito',
      medioPagoDetalle: medio,
      rubro: RUBRO[slug] || 'otros',
      diasSemana: dias,
      diasTexto: C.diasATexto(dias),
      vigenciaDesde: it.fechaVigenciaDesde || hoy,
      vigenciaHasta: it.fechaVigenciaHasta || hoy,
      porcentajeDescuento: piso,
      ...(usarNiveles ? { niveles } : {}),
      tipoTope: tipoTope || 'sin_tope',
      montoTope: tipoTope && tipoTope !== 'sin_tope' ? topePiso : null,
      minimoCompra: minimo,
      montoGastoOptimo: C.gastoOptimo(tipoTope && tipoTope !== 'sin_tope' ? topePiso : null, piso),
      condicionUso: `Pagar en ${nombre} con ${medio}.`,
      localesAdheridos: nombre,
      aclaraciones: [
        usarNiveles ? `Ahorro por nivel de cliente: ${niveles.map(n => `${n.nivel} ${n.porcentaje}%${n.montoTope ? ` (tope $${n.montoTope.toLocaleString('es-AR')})` : ''}`).join(', ')}.` : `${piso}% de ahorro.`,
        tipoTope === 'sin_tope' ? 'Sin tope.' : tipoTope ? `Tope ${tipoTope.replace('por_', 'por ')}.` : '',
        minimo ? `Mínimo de compra $${minimo.toLocaleString('es-AR')}.` : '',
        ...notas,
        motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
      ].filter(Boolean).join(' '),
      fuenteUrl: `${ORIGEN}/personas/beneficios/detalle/${it.id}`,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
      _meta: { rubroSupervielle: slug, idBeneficioClasico: it.id, idBeneficioIdentite: idt && idt.id },
    });
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Banco Supervielle', bancoIds: ['supervielle'], extraidas, ignoradas });
}

auditarSupervielle().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Supervielle:', err);
  process.exit(1);
});
