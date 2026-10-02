/**
 * Monitor Agent: Extractor y Auditor de Banco Galicia
 * Fuente pública: https://www.galicia.ar/personas/buscador-de-promociones
 *
 * El buscador es una SPA (iframe beneficios.galicia.ar) que consume un BFF JSON público, así que NO hace
 * falta Playwright. Endpoints identificados con DevTools > Network mientras se aplicaban filtros:
 *   GET /api/portal/personalizacion/v1/categorias
 *   GET /api/portal/personalizacion/v1/promociones/catalogo?page&pageSize&IdCategoria&Provincia&Localidad
 *   GET /api/portal/catalogo/v1/promociones/idPromocion/{id}     (detalle: %, tope, período, mínimo, legales)
 *
 * El filtro `Localidad=MAR DEL PLATA` se aplica en el servidor (Supermercados: 63 -> 9 promos), por lo que
 * la geografía queda verificada por la fuente. El WAF de Galicia rechaza (403) parámetros desconocidos y
 * ráfagas: se usan solo los nombres de parámetro confirmados y una pausa entre requests.
 *
 * Reglas: nada por defecto. Excluidas (no se cargan): promos de haberes/sueldo, segmentos exclusivos
 * (Éminent, etc.), solo cuotas sin descuento. Sin tope/período verificable => activo:false + nota.
 */

const C = require('./utils/common');
const { generarReporte } = require('./utils/diff-reporter');

const FUENTE_ID = 'galicia';
const BFF = 'https://loyalty.bff.bancogalicia.com.ar/api/portal';
const PROVINCIA = 'BUENOS AIRES';
const LOCALIDAD = 'MAR DEL PLATA';
const PAUSA_MS = 120;

/**
 * Rubro por marca cuando la categoría de Galicia no alcanza: farmacias, perfumerías y ópticas van a 'farmacia';
 * colectivos, SUBE y estacionamientos a 'transporte'. Si no, se usa la categoría (y 'otros' si no está listada).
 */
function rubroGalicia(marca, idCategoria) {
  if (/farmac|perfumer|optic|óptic|simplicity|juleriaque|get the look/i.test(marca)) return 'farmacia';
  if (/colectivo|\bsube\b|transporte|estacionamiento|cabify|uber/i.test(marca)) return 'transporte';
  return RUBRO[idCategoria] || 'otros';
}

/** IdCategoria de Galicia -> rubro de PagaMejor (las no listadas quedan en 'otros'). */
const RUBRO = { 8: 'supermercado', 1: 'gastronomia', 7: 'indumentaria', 4: 'hogar', 121: 'mascotas', 122: 'libreria', 11: 'libreria', 6: 'entretenimiento', 9: 'tecnologia' };
const PERIODO = { mensual: 'por_mes', semanal: 'por_semana', diario: 'por_dia', diaria: 'por_dia' };
const CODIGOS_DIA = { Lu: 1, Ma: 2, Mi: 3, Ju: 4, Vi: 5, Sa: 6, Do: 0 };

const dormir = ms => new Promise(r => setTimeout(r, ms));
async function api(pathQuery) {
  await dormir(PAUSA_MS);
  return C.fetchJson(`${BFF}/${pathQuery}`, { headers: { Accept: 'application/json' } });
}

const fechaDMY = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

async function auditarGalicia() {
  console.log(`[monitor-agent] Consultando API de Galicia (${LOCALIDAD})...`);
  const hoy = C.hoyISO();
  const cats = (await api('personalizacion/v1/categorias?idAudiencia=1&SubCategoria=false&Visibles=true')).data.list;

  const listado = new Map();
  for (const cat of cats) {
    for (let page = 1; page < 20; page++) {
      const q = `personalizacion/v1/promociones/catalogo?page=${page}&pageSize=100&IdCategoria=${cat.id}&Provincia=${encodeURIComponent(PROVINCIA)}&Localidad=${encodeURIComponent(LOCALIDAD)}`;
      const j = await api(q);
      const lista = (j.data && j.data.list) || [];
      lista.forEach(p => { if (!listado.has(p.id)) listado.set(p.id, { ...p, _cat: cat }); });
      if (lista.length < 100) break;
    }
    console.log(` -> ${cat.descripcion}: ${[...listado.values()].filter(p => p._cat.id === cat.id).length}`);
  }
  console.log(`[monitor-agent] ${listado.size} promos en Mar del Plata. Leyendo detalle...`);

  const extraidas = [];
  const ignoradas = [];

  for (const item of listado.values()) {
    let d;
    try {
      d = (await api(`catalogo/v1/promociones/idPromocion/${item.id}`)).data;
    } catch (e) {
      ignoradas.push({ id: item.id, marca: item.titulo, motivo: `No se pudo leer el detalle: ${e.message}` });
      continue;
    }
    const marca = (d.marca && d.marca.nombre) || item.titulo;

    // ---- Exclusiones
    if (!d.porcentajeAhorro) { ignoradas.push({ id: item.id, marca, motivo: 'Sin porcentaje de ahorro (solo cuotas u otro beneficio)' }); continue; }
    if (d.haberes || item.haberes) { ignoradas.push({ id: item.id, marca, motivo: 'Requiere acreditar haberes/sueldo' }); continue; }
    if ((d.modeloAtencion && d.modeloAtencion.exclusivo) || (item.modeloAtencion && item.modeloAtencion.exclusivo)) {
      ignoradas.push({ id: item.id, marca, motivo: `Segmento exclusivo (${(d.modeloAtencion || item.modeloAtencion).nombre})` }); continue;
    }
    // A veces el segmento no viene marcado "exclusivo" pero el legal lo dice ("…en el País para clientes Éminent";
    // modeloAtencion "Eminent Black" con exclusivo:false): PagaMejor todavía no pregunta el paquete de cuenta
    if (/para clientes (eminent|e-?minent|move|prefer)/i.test(C.norm(d.legales || ''))) {
      ignoradas.push({ id: item.id, marca, motivo: `Segmento exclusivo según el legal (${(d.modeloAtencion && d.modeloAtencion.nombre) || 'Éminent'})` }); continue;
    }
    if (item.proximamente || d.proximamente) { ignoradas.push({ id: item.id, marca, motivo: 'Próximamente (aún no vigente)' }); continue; }

    const motivos = [];
    const notas = [];
    const pct = d.porcentajeAhorro;

    // Días: leyenda del listado ("Lunes", "Lunes a viernes"...) y, de respaldo, códigos "Lu-Ma"
    let dias = C.parseDias(item.leyendaDiasAplicacion || d.leyendaCompra);
    if (!dias && d.diasAplicacion) {
      dias = [...new Set((d.diasAplicacion.match(/Lu|Ma|Mi|Ju|Vi|Sa|Do/g) || []).map(c => CODIGOS_DIA[c]))].sort();
      if (!dias.length) dias = null;
    }
    if (!dias) motivos.push('No se pudieron determinar los días.');

    const desde = fechaDMY(d.fechaDesde);
    const hasta = fechaDMY(d.fechaHasta) || fechaDMY(item.fechaHasta);
    if (!hasta) motivos.push('Sin fecha de vigencia.');

    // Tope
    let tipoTope = null;
    let montoTope = null;
    const periodicidad = C.norm(d.periodicidad || '');
    if (d.topeReintegro > 0 && PERIODO[periodicidad]) { tipoTope = PERIODO[periodicidad]; montoTope = d.topeReintegro; }
    else if (d.topeReintegro > 0 && /por compra|operacion|transaccion|ticket/.test(C.norm(`${d.periodicidad} ${d.leyendaTope} ${d.tipoTope}`))) { tipoTope = 'por_compra'; montoTope = d.topeReintegro; }
    else if (d.topeReintegro > 0) motivos.push(`Tope de $${d.topeReintegro} con periodicidad "${d.periodicidad || '-'}" no reconocida; no se asume.`);
    else if (/sin tope/i.test(`${d.leyendaTope || ''} ${d.legales || ''}`)) tipoTope = 'sin_tope';
    else motivos.push('La fuente no informa tope ni dice "sin tope".');

    // Mínimo: ficha vs legal (la propia fuente a veces es inconsistente => se usa el mayor y se avisa)
    const minLegal = (() => {
      const m = /compras?\s+(?:superiores|mayores)\s+a\s+\$\s*([\d.]+)/i.exec(d.legales || '');
      return m ? parseInt(m[1].replace(/\./g, ''), 10) : C.parseMinimo(d.legales || '');
    })();
    const minFicha = d.minimoCompra || null;
    let minimo = minFicha || minLegal || null;
    if (minFicha && minLegal && minFicha !== minLegal) {
      minimo = Math.max(minFicha, minLegal);
      notas.push(`La fuente informa mínimos distintos (ficha $${minFicha.toLocaleString('es-AR')}, legal $${minLegal.toLocaleString('es-AR')}); se usa el mayor.`);
    }

    // Medios de pago
    const medios = d.mediosDePago || item.mediosDePago || [];
    const tieneCred = medios.some(m => /cred/i.test(m.tipoTarjeta));
    const tieneDeb = medios.some(m => /deb/i.test(m.tipoTarjeta));
    if (!medios.length) motivos.push('La fuente no lista medios de pago.');
    const via = [d.flagQR && 'QR', d.flagNFC && 'NFC/contactless'].filter(Boolean).join(' o ');
    const medioDetalle = `${tieneCred && tieneDeb ? 'Tarjetas de crédito y débito' : tieneCred ? 'Tarjetas de crédito' : 'Tarjeta de débito'} Galicia${via ? ` (pagando con ${via})` : ''}`;
    const online = !!d.tiendaOnline;
    const fisica = !!d.tiendaFisica;
    if (d.descripcionAdicional) notas.push(`Condición: ${d.descripcionAdicional}.`);
    if (online && !fisica) notas.push('Solo tienda online.');

    extraidas.push({
      id: `gal-${item.id}`,
      bancoBilleteraId: 'galicia',
      bancoBilleteraNombre: 'Banco Galicia',
      tipoMedioRequerido: tieneCred && tieneDeb ? 'cualquiera' : tieneCred ? 'credito' : 'debito',
      medioPagoDetalle: medioDetalle,
      rubro: rubroGalicia(marca, item._cat.id),
      diasSemana: dias || [],
      diasTexto: C.diasATexto(dias),
      vigenciaDesde: desde || hoy,
      vigenciaHasta: hasta || hoy,
      porcentajeDescuento: pct,
      tipoTope: tipoTope || 'sin_tope',
      montoTope,
      minimoCompra: minimo,
      montoGastoOptimo: C.gastoOptimo(montoTope, pct),
      condicionUso: d.leyendaPaga || `Pagar en ${marca} con ${medioDetalle}.`,
      localesAdheridos: marca,
      aclaraciones: [
        `${pct}% de ahorro ${dias ? C.diasATexto(dias).toLowerCase() : ''} en ${marca}.`,
        tipoTope === 'sin_tope' ? 'Sin tope.' : montoTope ? `Tope $${montoTope.toLocaleString('es-AR')} ${tipoTope.replace('por_', 'por ')}${d.tipoTope ? ` (${d.tipoTope.toLowerCase()})` : ''}.` : '',
        minimo ? `Mínimo de compra $${minimo.toLocaleString('es-AR')}.` : '',
        ...notas,
        motivos.length ? `REVISAR: ${motivos.join(' ')}` : '',
      ].filter(Boolean).join(' '),
      fuenteUrl: `https://beneficios.galicia.ar/promocion/${item.id}%7C${C.slugify(marca)}%7C${(d.tipoPromocion || 'marca').toLowerCase()}`,
      fuenteId: FUENTE_ID,
      ultimaVerificacion: hoy,
      activo: motivos.length === 0,
      _meta: { idMarca: item.idMarca, categoria: item._cat.descripcion, tiendaOnline: online, tiendaFisica: fisica },
    });
  }

  generarReporte({ fuenteId: FUENTE_ID, fuenteNombre: 'Banco Galicia', bancoIds: ['galicia'], extraidas, ignoradas });
}

auditarGalicia().catch(err => {
  console.error('[monitor-agent] Error en auditoría de Galicia:', err);
  process.exit(1);
});
