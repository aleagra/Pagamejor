/**
 * Script de auditoría y monitoreo periódico de promociones (monitor-agent)
 * Se ejecuta de manera aislada al bundle del cliente.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const promosPath = path.join(__dirname, '../../src/data/promos.json');
const reportDir = path.join(__dirname, '../reports');
const reportPath = path.join(reportDir, 'audit-report.json');

const promos = JSON.parse(fs.readFileSync(promosPath, 'utf8'));

console.log(`[monitor-agent] Iniciando chequeo de ${promos.length} promociones...`);

const hoy = new Date();
const sieteDiasDespues = new Date();
sieteDiasDespues.setDate(hoy.getDate() + 7);

const hoyStr = hoy.toISOString().split('T')[0];
const sieteDiasStr = sieteDiasDespues.toISOString().split('T')[0];

const reporte = {
  fechaEjecucion: new Date().toISOString(),
  totalPromociones: promos.length,
  promocionesVencidas: [],
  promocionesProximasAVencer: [],
  promocionesActivas: [],
  alertas: []
};

promos.forEach((promo) => {
  if (promo.vigenciaHasta < hoyStr) {
    reporte.promocionesVencidas.push({
      id: promo.id,
      banco: promo.bancoBilleteraNombre,
      vigenciaHasta: promo.vigenciaHasta,
      fuenteUrl: promo.fuenteUrl
    });
    reporte.alertas.push(`[VENCIDA] Promo ${promo.id} de ${promo.bancoBilleteraNombre} venció el ${promo.vigenciaHasta}`);
  } else if (promo.vigenciaHasta <= sieteDiasStr) {
    reporte.promocionesProximasAVencer.push({
      id: promo.id,
      banco: promo.bancoBilleteraNombre,
      vigenciaHasta: promo.vigenciaHasta,
      fuenteUrl: promo.fuenteUrl
    });
    reporte.alertas.push(`[PRÓXIMA A VENCER] Promo ${promo.id} vence en menos de 7 días (${promo.vigenciaHasta})`);
  } else {
    reporte.promocionesActivas.push(promo.id);
  }
});

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(reportPath, JSON.stringify(reporte, null, 2), 'utf8');

console.log(`[monitor-agent] Chequeo finalizado.`);
console.log(` - Activas: ${reporte.promocionesActivas.length}`);
console.log(` - Próximas a vencer (7 días): ${reporte.promocionesProximasAVencer.length}`);
console.log(` - Vencidas: ${reporte.promocionesVencidas.length}`);
console.log(`Reporte guardado en: scripts/reports/audit-report.json`);
