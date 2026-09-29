/**
 * Herramienta del data-agent: aplica sobre src/data/promos.json el extract de una fuente,
 * DESPUÉS de que el usuario revisó y aprobó el reporte de diferencias.
 *
 * Uso:
 *   node scripts/data/apply-extract.js <fuenteId> [--dry] [--deactivate-missing] [--overwrite-texts] [--only=id1,id2]
 *
 *   --dry                 no escribe nada, solo muestra qué haría
 *   --deactivate-missing  las promos activas del catálogo que la fuente ya no muestra pasan a activo:false
 *   --overwrite-texts     pisa condicionUso/aclaraciones/locales/medio con los textos generados
 *                         (por defecto se conservan los textos curados salvo que cambie algo relevante)
 *   --prefix=modo-       amplía el alcance de --deactivate-missing a los ids con ese prefijo
 *   --include-inactive    también agrega las promos NUEVAS que la fuente marca inactivas (por defecto se omiten)
 *   --only=ids            aplica solo esos ids (aprobación parcial)
 *
 * Los campos con prefijo "_" del extract (ej. _meta) nunca se copian al catálogo.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const PROMOS_PATH = path.join(ROOT, 'src/data/promos.json');
const ESTADO_PATH = path.join(ROOT, 'scripts/monitors/checklist-state.json');

const [fuenteId, ...flags] = process.argv.slice(2);
if (!fuenteId) {
  console.error('Uso: node scripts/data/apply-extract.js <fuenteId> [--dry] [--deactivate-missing] [--overwrite-texts] [--only=ids]');
  process.exit(1);
}
const dry = flags.includes('--dry');
const incluirInactivas = flags.includes('--include-inactive');
const desactivarFaltantes = flags.includes('--deactivate-missing');
const pisarTextos = flags.includes('--overwrite-texts');
const prefijo = (flags.find(f => f.startsWith('--prefix=')) || '').replace('--prefix=', '');
const only = (flags.find(f => f.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);

const extractPath = path.join(ROOT, `scripts/reports/${fuenteId}-extract.json`);
if (!fs.existsSync(extractPath)) {
  console.error(`No existe ${extractPath}. Corré primero el monitor de la fuente.`);
  process.exit(1);
}
const extract = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(PROMOS_PATH, 'utf8'));
const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const limpiar = p => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('_')));
const ESTRUCTURALES = ['bancoBilleteraId', 'bancoBilleteraNombre', 'porcentajeDescuento', 'niveles', 'tipoTope', 'montoTope', 'minimoCompra', 'montoGastoOptimo', 'vigenciaDesde', 'vigenciaHasta', 'diasSemana', 'diasTexto', 'activo', 'fuenteId', 'ultimaVerificacion', 'fuenteUrl', 'rubro', 'tipoMedioRequerido'];
const RELEVANTES = ['porcentajeDescuento', 'niveles', 'tipoTope', 'montoTope', 'minimoCompra', 'diasSemana', 'activo'];
const TEXTOS = ['condicionUso', 'aclaraciones', 'localesAdheridos', 'medioPagoDetalle'];
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const porId = new Map(catalogo.map((p, i) => [p.id, i]));
const log = { nuevas: [], actualizadas: [], confirmadas: [], desactivadas: [] };

for (const ex of extract) {
  if (only.length && !only.includes(ex.id)) continue;
  const nuevo = limpiar(ex);
  if (!porId.has(ex.id)) {
    if (!nuevo.activo && !incluirInactivas) continue; // candidatas inactivas: no engordan el catálogo del cliente
    catalogo.push(nuevo);
    porId.set(ex.id, catalogo.length - 1);
    log.nuevas.push(ex.id);
    continue;
  }
  const i = porId.get(ex.id);
  const actual = catalogo[i];
  const huboCambioRelevante = RELEVANTES.some(c => !igual(actual[c], nuevo[c]));
  const huboCambio = ESTRUCTURALES.some(c => c !== 'ultimaVerificacion' && !igual(actual[c], nuevo[c]));
  for (const c of ESTRUCTURALES) {
    if (c in nuevo) actual[c] = nuevo[c];
    else if (c === 'niveles') delete actual.niveles;
  }
  if (pisarTextos || huboCambioRelevante) for (const c of TEXTOS) if (nuevo[c] !== undefined) actual[c] = nuevo[c];
  (huboCambio ? log.actualizadas : log.confirmadas).push(ex.id);
}

if (desactivarFaltantes) {
  const vistos = new Set(extract.map(e => e.id));
  const bancos = new Set(extract.map(e => e.bancoBilleteraId));
  for (const p of catalogo) {
    const esDeLaFuente = p.fuenteId === fuenteId || (prefijo && String(p.id).startsWith(prefijo)) || (!p.fuenteId && bancos.has(p.bancoBilleteraId));
    if (!esDeLaFuente || !p.activo || vistos.has(p.id)) continue;
    if (only.length && !only.includes(p.id)) continue;
    p.activo = false;
    p.aclaraciones = `No figura en la fuente oficial al ${hoy}; desactivada hasta poder verificarla (si sigue vigente en la app, reactivar con captura). ${p.aclaraciones || ''}`.trim();
    log.desactivadas.push(p.id);
  }
}

console.log(`[data-agent] ${fuenteId}: ${log.nuevas.length} nuevas, ${log.actualizadas.length} actualizadas, ${log.confirmadas.length} solo re-verificadas, ${log.desactivadas.length} desactivadas.`);
if (dry) {
  console.log(JSON.stringify(log, null, 2));
  console.log('(--dry: no se escribió nada)');
  process.exit(0);
}

fs.writeFileSync(PROMOS_PATH, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
try {
  const estado = JSON.parse(fs.readFileSync(ESTADO_PATH, 'utf8'));
  estado[fuenteId] = { ...(estado[fuenteId] || {}), ultimaAplicacion: hoy };
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2) + '\n', 'utf8');
} catch { /* el estado es informativo */ }

try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/validate-data.js')], { stdio: 'inherit' });
} catch {
  console.error('La validación falló: revisá src/data/promos.json (git diff) antes de continuar.');
  process.exit(1);
}
