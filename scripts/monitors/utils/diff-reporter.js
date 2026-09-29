const path = require('path');
const { hoyISO, escribirJson, leerJson, REPORTS_DIR } = require('./common');

/**
 * Reporte de diferencias del monitor-agent.
 *
 * Compara lo extraído de una fuente contra src/data/promos.json y escribe:
 *   scripts/reports/<fuenteId>-extract.json   promos extraídas (con el esquema del catálogo)
 *   scripts/reports/<fuenteId>-report.json    diferencias para revisión humana
 *
 * NUNCA modifica promos.json (dominio del data-agent).
 *
 * Emparejamiento: por `id` exacto. Cada extractor es responsable de generar ids estables
 * (o de mapear a los ids ya existentes del catálogo mediante un alias explícito).
 */

const PROMOS_PATH = path.join(__dirname, '../../../src/data/promos.json');
const ESTADO_PATH = path.join(__dirname, '../checklist-state.json');

const CAMPOS_COMPARABLES = [
  'bancoBilleteraId', 'porcentajeDescuento', 'niveles', 'tipoTope', 'montoTope', 'minimoCompra',
  'vigenciaDesde', 'vigenciaHasta', 'diasSemana', 'activo',
];

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Actualiza la fecha de última verificación de la fuente en el estado del checklist. */
function registrarVerificacion(fuenteId, datos) {
  const estado = leerJson(ESTADO_PATH, {});
  estado[fuenteId] = { ...(estado[fuenteId] || {}), ...datos };
  require('fs').writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2) + '\n', 'utf8');
}

/**
 * @param {object} cfg
 * @param {string} cfg.fuenteId        id de la fuente (ej. 'uala'); también fuenteId de las promos
 * @param {string} cfg.fuenteNombre    nombre legible
 * @param {string[]} cfg.bancoIds      bancoBilleteraId cubiertos por la fuente
 * @param {object[]} cfg.extraidas     promos con el esquema del catálogo
 * @param {boolean} [cfg.alcanceCompleto=true]  si false, no se marcan "noEncontradas" (extracción parcial)
 * @param {object[]} [cfg.ignoradas]   items de la fuente descartados a propósito (con motivo)
 * @param {(p:object)=>boolean} [cfg.filtroCatalogo] cómo elegir qué promos del catálogo pertenecen a la fuente
 */
function generarReporte(cfg) {
  const { fuenteId, fuenteNombre, bancoIds = [], extraidas, ignoradas = [], alcanceCompleto = true } = cfg;
  const catalogo = leerJson(PROMOS_PATH, []);
  const hoy = hoyISO();
  const en7 = hoyISO(new Date(Date.now() + 7 * 86400000));

  const filtro = cfg.filtroCatalogo
    || (p => p.fuenteId === fuenteId || (!p.fuenteId && bancoIds.includes(p.bancoBilleteraId)));
  const delCatalogo = catalogo.filter(filtro);
  const mapa = new Map(delCatalogo.map(p => [p.id, p]));
  const idsExtraidos = new Set();

  const nuevas = [];
  const inactivasNuevas = [];
  const modificadas = [];
  const vigentesConfirmadas = [];

  for (const ex of extraidas) {
    idsExtraidos.add(ex.id);
    const actual = mapa.get(ex.id);
    if (!actual) {
      // Inactiva y aún no cargada: candidata a revisar, no cuenta como novedad del catálogo
      (ex.activo ? nuevas : inactivasNuevas).push(ex);
      continue;
    }
    const cambios = CAMPOS_COMPARABLES
      .filter(c => !igual(actual[c], ex[c]))
      .map(c => ({ campo: c, actual: actual[c] ?? null, detectado: ex[c] ?? null }));
    if (cambios.length) modificadas.push({ id: ex.id, cambios, detectada: ex });
    else vigentesConfirmadas.push(ex.id);
  }

  const noEncontradas = alcanceCompleto
    ? delCatalogo
        .filter(p => p.activo && !idsExtraidos.has(p.id))
        .map(p => ({ id: p.id, rubro: p.rubro, locales: p.localesAdheridos, vigenciaHasta: p.vigenciaHasta, motivo: 'Activa en el catálogo pero no figura en la fuente' }))
    : [];

  const vencidas = delCatalogo
    .filter(p => p.activo && p.vigenciaHasta < hoy)
    .map(p => ({ id: p.id, vigenciaHasta: p.vigenciaHasta }));

  const porVencer = extraidas
    .filter(p => p.activo && p.vigenciaHasta >= hoy && p.vigenciaHasta <= en7)
    .map(p => ({ id: p.id, vigenciaHasta: p.vigenciaHasta }));

  const inactivasPorVerificar = inactivasNuevas.map(p => ({ id: p.id, rubro: p.rubro, locales: p.localesAdheridos, motivo: (/REVISAR: (.*)$/.exec(p.aclaraciones) || [, p.aclaraciones])[1] }));

  const reporte = {
    fuenteId,
    fuente: fuenteNombre,
    fechaAuditoria: new Date().toISOString(),
    resumen: {
      extraidas: extraidas.length,
      enCatalogo: delCatalogo.length,
      vigentesConfirmadas: vigentesConfirmadas.length,
      modificadas: modificadas.length,
      nuevas: nuevas.length,
      noEncontradas: noEncontradas.length,
      vencidasEnCatalogo: vencidas.length,
      vencenEn7Dias: porVencer.length,
      extraidasInactivas: inactivasPorVerificar.length,
      ignoradas: ignoradas.length,
    },
    detalle: { nuevas, modificadas, noEncontradas, vencidas, porVencer, inactivasPorVerificar, ignoradas, vigentesConfirmadas },
  };

  escribirJson(`${fuenteId}-extract.json`, extraidas);
  escribirJson(`${fuenteId}-report.json`, reporte);
  registrarVerificacion(fuenteId, {
    ultimaVerificacion: hoy,
    ultimoResultado: 'ok',
    resumen: reporte.resumen,
  });

  const r = reporte.resumen;
  console.log('\n======================================================');
  console.log(`REPORTE: ${fuenteNombre.toUpperCase()}  (${hoy})`);
  console.log('======================================================');
  console.log(`Extraídas de la fuente:      ${r.extraidas}   (inactivas por verificar: ${r.extraidasInactivas}, ignoradas: ${r.ignoradas})`);
  console.log(`En promos.json:              ${r.enCatalogo}`);
  console.log(`  Vigentes confirmadas:      ${r.vigentesConfirmadas}`);
  console.log(`  Modificaciones:            ${r.modificadas}`);
  console.log(`  Nuevas:                    ${r.nuevas}`);
  console.log(`  Activas y no encontradas:  ${r.noEncontradas}`);
  console.log(`  Vencidas en catálogo:      ${r.vencidasEnCatalogo}`);
  console.log(`  Vencen en 7 días:          ${r.vencenEn7Dias}`);
  console.log(`Reporte: scripts/reports/${fuenteId}-report.json`);
  console.log('======================================================\n');

  return reporte;
}

/** Compatibilidad con los scripts viejos: generarReporteDiferencias(nombre, bancoId, promos) */
function generarReporteDiferencias(fuenteNombre, bancoBilleteraId, promosExtraidas) {
  const fuenteId = fuenteNombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  return generarReporte({ fuenteId, fuenteNombre, bancoIds: [bancoBilleteraId], extraidas: promosExtraidas });
}

module.exports = { generarReporte, generarReporteDiferencias, registrarVerificacion, REPORTS_DIR };
