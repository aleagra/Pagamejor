#!/usr/bin/env node
/**
 * Monitor Agent: checklist y corrida mensual de las fuentes de promociones.
 *
 * Las promos bancarias argentinas se renuevan el día 1: este script lista las fuentes con su fecha de última
 * verificación, corre las automatizables y arma UN reporte de diferencias contra src/data/promos.json para
 * que lo revises ANTES de aprobar cualquier cambio. Nunca modifica promos.json.
 *
 * Uso:
 *   node scripts/monitors/monthly-check.js                  estado del checklist (no corre nada)
 *   node scripts/monitors/monthly-check.js --run            corre todas las fuentes automatizables + reporte
 *   node scripts/monitors/monthly-check.js --run --only=galicia,uala
 *   node scripts/monitors/monthly-check.js --run --if-first-business-day
 *                                                           (para cron/tarea programada: corre solo el primer
 *                                                            día hábil del mes; el resto de los días no hace nada)
 *   node scripts/monitors/monthly-check.js --mark=mercadopago-app
 *                                                           registra que hoy se cargaron capturas manuales
 *
 * Salidas:
 *   scripts/reports/checklist.md         estado de las fuentes + recordatorios manuales
 *   scripts/reports/monthly-report.md    diferencias por fuente para revisar (y monthly-report.json)
 *   scripts/monitors/checklist-state.json  fechas de última verificación / aplicación por fuente
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('./utils/common');

const ROOT = path.join(__dirname, '../..');
const FUENTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));
const ESTADO_PATH = path.join(__dirname, 'checklist-state.json');
const PROMOS_PATH = path.join(ROOT, 'src/data/promos.json');
const DIAS_MAX = 31;

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const valor = n => (args.find(a => a.startsWith(`${n}=`)) || '').split('=')[1];

// ---------------------------------------------------------------- Fechas

/** Feriados nacionales de fecha fija que caen en día 1 (los móviles/puentes no se contemplan). */
const FERIADOS_DIA_1 = ['01-01', '05-01'];

function esHabil(d) {
  const dow = d.getUTCDay();
  const mmdd = d.toISOString().slice(5, 10);
  return dow !== 0 && dow !== 6 && !FERIADOS_DIA_1.includes(mmdd);
}

/** Primer día hábil (lunes a viernes, no feriado fijo) del mes de la fecha dada, en formato YYYY-MM-DD. */
function primerDiaHabil(hoyISO) {
  const [y, m] = hoyISO.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (!esHabil(d)) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ---------------------------------------------------------------- Estado

const leerEstado = () => C.leerJson(ESTADO_PATH, {});
const escribirEstado = e => fs.writeFileSync(ESTADO_PATH, JSON.stringify(e, null, 2) + '\n', 'utf8');

function estadoDe(fuente, estado, hoy) {
  const e = estado[fuente.id] || {};
  if (fuente.manual) {
    if (!e.ultimaVerificacion) return { etiqueta: 'MANUAL - sin capturas registradas', urgente: true };
    const dias = diasEntre(e.ultimaVerificacion, hoy);
    return { etiqueta: dias > DIAS_MAX ? `MANUAL - capturas de hace ${dias} días` : 'MANUAL - al día', urgente: dias > DIAS_MAX };
  }
  if (e.ultimoResultado === 'error') return { etiqueta: 'ERROR en la última corrida', urgente: true };
  if (!e.ultimaVerificacion) return { etiqueta: 'NUNCA verificada', urgente: true };
  const dias = diasEntre(e.ultimaVerificacion, hoy);
  const r = e.resumen || {};
  const pendientes = (r.modificadas || 0) + (r.nuevas || 0) + (r.noEncontradas || 0);
  if (dias > DIAS_MAX) return { etiqueta: `DESACTUALIZADA (${dias} días)`, urgente: true };
  if (pendientes > 0 && (!e.ultimaAplicacion || e.ultimaAplicacion < e.ultimaVerificacion)) {
    return { etiqueta: `Verificada, ${pendientes} cambios sin aplicar`, urgente: false };
  }
  return { etiqueta: 'OK', urgente: false };
}

// ---------------------------------------------------------------- Checklist

function generarChecklist(estado, hoy) {
  const primero = primerDiaHabil(hoy);
  const [y, m] = hoy.split('-').map(Number);
  const proxMes = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const proximo = hoy <= primero ? primero : primerDiaHabil(proxMes);
  const filas = FUENTES.map(f => {
    const e = estado[f.id] || {};
    const st = estadoDe(f, estado, hoy);
    return `| ${f.nombre} | ${f.manual ? 'Manual' : 'Automática'} | ${e.ultimaVerificacion || '—'} | ${e.ultimaAplicacion || '—'} | ${st.urgente ? '⚠️ ' : ''}${st.etiqueta} |`;
  });
  const manuales = FUENTES.filter(f => f.manual);
  const md = [
    '# Checklist mensual de promociones',
    '',
    `Generado el ${hoy}. Primer día hábil de este mes: **${primero}**. Próxima corrida: **${proximo}**.`,
    '',
    '| Fuente | Tipo | Última verificación | Última aplicación al catálogo | Estado |',
    '| :-- | :-- | :-- | :-- | :-- |',
    ...filas,
    '',
    '## Recordatorios manuales (requieren que entres a la app y mandes capturas ese mismo día)',
    ...manuales.map(f => `- [ ] **${f.nombre}** — ${f.recordatorio}`),
    '',
    '## Qué hacer el primer día hábil de cada mes',
    '1. `npm run monitor:monthly` (o `node scripts/monitors/monthly-check.js --run`) corre las fuentes automáticas.',
    '2. Revisá `scripts/reports/monthly-report.md`: modificadas, nuevas, no encontradas y vencidas.',
    '3. Mandale al data-agent las capturas de las fuentes manuales.',
    '4. Aprobado el reporte: `node scripts/data/apply-extract.js <fuente> --deactivate-missing` por cada fuente (o `--dry` primero).',
    '5. `npm run validate-data` y `npm run test:logic`.',
    '',
  ].join('\n');
  fs.mkdirSync(C.REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(C.REPORTS_DIR, 'checklist.md'), md, 'utf8');
  return md;
}

function imprimirEstado(estado, hoy) {
  console.log(`\nChecklist de fuentes (${hoy}) — primer día hábil del mes: ${primerDiaHabil(hoy)}\n`);
  const ancho = Math.max(...FUENTES.map(f => f.nombre.length));
  FUENTES.forEach(f => {
    const e = estado[f.id] || {};
    const st = estadoDe(f, estado, hoy);
    console.log(`${st.urgente ? '⚠️ ' : '   '}${f.nombre.padEnd(ancho)}  ${(f.manual ? 'manual' : 'auto').padEnd(6)}  verif: ${(e.ultimaVerificacion || '—').padEnd(10)}  aplic: ${(e.ultimaAplicacion || '—').padEnd(10)}  ${st.etiqueta}`);
  });
  console.log('\nRecordatorios manuales:');
  FUENTES.filter(f => f.manual).forEach(f => console.log(`  • ${f.nombre}: ${f.recordatorio}`));
  console.log('\n(Checklist guardado en scripts/reports/checklist.md)\n');
}

// ---------------------------------------------------------------- Reporte mensual

function generarReporteMensual(resultados, hoy) {
  const catalogo = C.leerJson(PROMOS_PATH, []);
  const en7 = C.hoyISO(new Date(Date.now() + 7 * 86400000));
  const activas = catalogo.filter(p => p.activo);
  const lineas = [`# Reporte mensual de promociones — ${hoy}`, '', 'Revisá qué cambió **antes** de aprobar. Nada de esto modifica `src/data/promos.json` todavía.', ''];

  lineas.push('## Resumen', '', '| Fuente | Resultado | Extraídas | Vigentes ok | Modificadas | Nuevas | Activas no encontradas | Inactivas por verificar |', '| :-- | :-- | --: | --: | --: | --: | --: | --: |');
  for (const r of resultados) {
    const rep = C.leerJson(path.join(C.REPORTS_DIR, `${r.fuente.id}-report.json`));
    const s = rep && r.ok ? rep.resumen : null;
    lineas.push(s
      ? `| ${r.fuente.nombre} | ✅ | ${s.extraidas} | ${s.vigentesConfirmadas} | ${s.modificadas} | ${s.nuevas} | ${s.noEncontradas} | ${s.extraidasInactivas} |`
      : `| ${r.fuente.nombre} | ❌ ${r.error || 'sin reporte'} | — | — | — | — | — | — |`);
  }
  lineas.push('');

  for (const r of resultados.filter(x => x.ok)) {
    const rep = C.leerJson(path.join(C.REPORTS_DIR, `${r.fuente.id}-report.json`));
    if (!rep) continue;
    const d = rep.detalle;
    const hayAlgo = d.modificadas.length || d.nuevas.length || d.noEncontradas.length || d.vencidas.length;
    lineas.push(`## ${r.fuente.nombre}`, '');
    if (!hayAlgo) { lineas.push('Sin cambios respecto del catálogo.', ''); continue; }
    if (d.modificadas.length) {
      lineas.push(`**Modificadas (${d.modificadas.length})**`);
      d.modificadas.forEach(m => lineas.push(`- \`${m.id}\`: ${m.cambios.filter(c => c.campo !== 'vigenciaDesde').map(c => `${c.campo} ${JSON.stringify(c.actual)} → ${JSON.stringify(c.detectado)}`).join('; ')}`));
      lineas.push('');
    }
    if (d.nuevas.length) {
      lineas.push(`**Nuevas activas (${d.nuevas.length})**`);
      d.nuevas.forEach(n => lineas.push(`- \`${n.id}\` ${n.localesAdheridos} — ${n.porcentajeDescuento}% ${n.diasTexto}, tope ${n.tipoTope === 'sin_tope' ? 'sin tope' : `$${n.montoTope} ${n.tipoTope.replace('por_', 'por ')}`}, hasta ${n.vigenciaHasta}`));
      lineas.push('');
    }
    if (d.noEncontradas.length) {
      lineas.push(`**Activas en el catálogo que la fuente ya no muestra (${d.noEncontradas.length})** — se desactivarían con \`--deactivate-missing\``);
      d.noEncontradas.forEach(n => lineas.push(`- \`${n.id}\` ${n.locales || ''} (hasta ${n.vigenciaHasta})`));
      lineas.push('');
    }
    if (d.vencidas.length) lineas.push(`**Vencidas en el catálogo (${d.vencidas.length}):** ${d.vencidas.map(v => `\`${v.id}\``).join(', ')}`, '');
  }

  const vencenPronto = activas.filter(p => p.vigenciaHasta <= en7);
  lineas.push('## Catálogo actual', '',
    `- Promos activas: **${activas.length}** de ${catalogo.length}.`,
    `- Activas que vencen en los próximos 7 días: **${vencenPronto.length}**${vencenPronto.length ? ` (${[...new Set(vencenPronto.map(p => p.fuenteId || 'legacy'))].join(', ')})` : ''}.`,
    `- Activas ya vencidas (el engine las oculta): **${activas.filter(p => p.vigenciaHasta < hoy).length}**.`, '');

  lineas.push('## Fuentes manuales — requieren que entres a la app y mandes capturas hoy', '');
  FUENTES.filter(f => f.manual).forEach(f => lineas.push(`- [ ] **${f.nombre}**: ${f.recordatorio}`));
  lineas.push('', '## Para aprobar', '', 'Por cada fuente aprobada: `node scripts/data/apply-extract.js <fuenteId> --deactivate-missing` (agregá `--dry` para simular, `--only=id1,id2` para aprobar parcialmente).', '');

  const md = lineas.join('\n');
  fs.writeFileSync(path.join(C.REPORTS_DIR, 'monthly-report.md'), md, 'utf8');
  C.escribirJson('monthly-report.json', {
    fecha: hoy,
    resultados: resultados.map(r => ({ fuente: r.fuente.id, ok: r.ok, error: r.error || null })),
    catalogo: { total: catalogo.length, activas: activas.length, vencenEn7Dias: vencenPronto.length },
  });
  return md;
}

// ---------------------------------------------------------------- Corrida

function correrFuente(f) {
  console.log(`\n▶ ${f.nombre} (${f.script})`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, f.script)], { cwd: ROOT, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.status === 0) {
    console.log(`  ✅ ok en ${seg}s`);
    return { fuente: f, ok: true };
  }
  const error = (r.stderr || r.error && r.error.message || `exit ${r.status}`).toString().split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 300);
  console.log(`  ❌ falló en ${seg}s: ${error}`);
  return { fuente: f, ok: false, error };
}

function main() {
  const hoy = C.hoyISO();
  const marcar = valor('--mark');
  if (marcar) {
    const estado = leerEstado();
    marcar.split(',').forEach(id => {
      if (!FUENTES.some(f => f.id === id)) { console.error(`Fuente desconocida: ${id}`); process.exit(1); }
      estado[id] = { ...(estado[id] || {}), ultimaVerificacion: hoy, ultimoResultado: 'manual' };
      console.log(`✔ ${id}: capturas manuales registradas el ${hoy}`);
    });
    escribirEstado(estado);
    generarChecklist(estado, hoy);
    return;
  }

  if (!flag('--run')) {
    const estado = leerEstado();
    generarChecklist(estado, hoy);
    imprimirEstado(estado, hoy);
    return;
  }

  if (flag('--if-first-business-day') && hoy !== primerDiaHabil(hoy)) {
    console.log(`[monitor-agent] Hoy (${hoy}) no es el primer día hábil del mes (${primerDiaHabil(hoy)}): no se corre nada.`);
    return;
  }

  const solo = (valor('--only') || '').split(',').filter(Boolean);
  const objetivo = FUENTES.filter(f => !f.manual && (!solo.length || solo.includes(f.id)));
  if (!objetivo.length) { console.error('No hay fuentes automatizables que correr con ese filtro.'); process.exit(1); }

  console.log(`[monitor-agent] Corrida ${hoy}: ${objetivo.map(f => f.id).join(', ')}`);
  const resultados = objetivo.map(correrFuente);

  const estado = leerEstado(); // los scripts actualizan su propia fecha al terminar bien
  resultados.filter(r => !r.ok).forEach(r => {
    estado[r.fuente.id] = { ...(estado[r.fuente.id] || {}), ultimoResultado: 'error', ultimoError: r.error, ultimoIntento: hoy };
  });
  escribirEstado(estado);

  generarReporteMensual(resultados, hoy);
  generarChecklist(estado, hoy);
  imprimirEstado(estado, hoy);

  const fallidas = resultados.filter(r => !r.ok);
  console.log('📄 Reporte para revisar: scripts/reports/monthly-report.md');
  console.log('   Cuando lo apruebes:   node scripts/data/apply-extract.js <fuenteId> --deactivate-missing');
  if (fallidas.length) {
    console.error(`\n⚠️  ${fallidas.length} fuente(s) fallaron: ${fallidas.map(r => r.fuente.id).join(', ')}`);
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { primerDiaHabil };
