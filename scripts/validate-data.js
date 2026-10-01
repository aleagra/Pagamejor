// Script de auditoría y validación del data-agent
const fs = require('fs');
const path = require('path');

const bancosPath = path.join(__dirname, '../src/data/bancos.json');
const rubrosPath = path.join(__dirname, '../src/data/rubros.json');
const promosPath = path.join(__dirname, '../src/data/promos.json');

const bancos = JSON.parse(fs.readFileSync(bancosPath, 'utf8'));
const rubros = JSON.parse(fs.readFileSync(rubrosPath, 'utf8'));
const promos = JSON.parse(fs.readFileSync(promosPath, 'utf8'));

const bancoIds = new Set(bancos.map(b => b.id));
const rubroIds = new Set(rubros.map(r => r.id));
const promoIds = new Set();

const errors = [];

console.log('Iniciando auditoría de datos por data-agent...');
console.log(`Bancos cargados: ${bancos.length}`);
console.log(`Rubros cargados: ${rubros.length}`);
console.log(`Promociones a validar: ${promos.length}\n`);

const sinComercio = [];
promos.forEach((promo, idx) => {
  const prefix = `[Promo #${idx + 1} ID: "${promo.id}"]`;

  // 1. Unicidad de ID
  if (!promo.id || typeof promo.id !== 'string') {
    errors.push(`${prefix} Debe tener un ID válido.`);
  } else if (promoIds.has(promo.id)) {
    errors.push(`${prefix} ID duplicado: ${promo.id}`);
  } else {
    promoIds.add(promo.id);
  }

  // 2. Banco existente
  if (!bancoIds.has(promo.bancoBilleteraId)) {
    errors.push(`${prefix} bancoBilleteraId "${promo.bancoBilleteraId}" no existe en bancos.json`);
  }

  // 3. Rubro existente
  if (!rubroIds.has(promo.rubro)) {
    errors.push(`${prefix} rubro "${promo.rubro}" no existe en rubros.json`);
  }

  // 4. Días de la semana válidos (0 a 6)
  if (!Array.isArray(promo.diasSemana) || promo.diasSemana.length === 0) {
    errors.push(`${prefix} diasSemana debe ser un array con al menos un día.`);
  } else {
    promo.diasSemana.forEach(dia => {
      if (typeof dia !== 'number' || dia < 0 || dia > 6) {
        errors.push(`${prefix} Día inválido: ${dia}. Debe ser entre 0 (domingo) y 6 (sábado).`);
      }
    });
  }

  // 5. Porcentaje
  if (typeof promo.porcentajeDescuento !== 'number' || promo.porcentajeDescuento <= 0 || promo.porcentajeDescuento > 100) {
    errors.push(`${prefix} porcentajeDescuento inválido: ${promo.porcentajeDescuento}`);
  }

  // 6. Topes
  const tiposValidos = ['sin_tope', 'por_compra', 'por_dia', 'por_semana', 'por_mes'];
  if (!tiposValidos.includes(promo.tipoTope)) {
    errors.push(`${prefix} tipoTope inválido: ${promo.tipoTope}`);
  }
  if (promo.tipoTope !== 'sin_tope' && (typeof promo.montoTope !== 'number' || promo.montoTope <= 0)) {
    errors.push(`${prefix} montoTope debe ser un número positivo para tipoTope "${promo.tipoTope}"`);
  }

  // 7. Condición de uso
  if (!promo.condicionUso || promo.condicionUso.trim().length === 0) {
    errors.push(`${prefix} Falta condicionUso.`);
  }

  // 8. Fechas de vigencia coherentes (YYYY-MM-DD)
  const reFecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!reFecha.test(promo.vigenciaDesde || '') || !reFecha.test(promo.vigenciaHasta || '')) {
    errors.push(`${prefix} vigenciaDesde/vigenciaHasta deben tener formato YYYY-MM-DD.`);
  } else if (promo.vigenciaDesde > promo.vigenciaHasta) {
    errors.push(`${prefix} vigenciaDesde (${promo.vigenciaDesde}) es posterior a vigenciaHasta (${promo.vigenciaHasta}).`);
  }

  // 9. Regla "no suponer": una promo inactiva debe explicar por qué en aclaraciones
  if (promo.activo === false && (!promo.aclaraciones || promo.aclaraciones.trim().length === 0)) {
    errors.push(`${prefix} activo:false exige una nota en aclaraciones explicando el motivo.`);
  }

  // 9b. alcanceLimitado: solo booleano (promos de lugares puntuales, que no deben quedar primeras)
  if (promo.alcanceLimitado !== undefined && typeof promo.alcanceLimitado !== 'boolean') {
    errors.push(`${prefix} alcanceLimitado debe ser true o false.`);
  }

  // 9c. El comercio tiene que nombrar el lugar, no ser un texto publicitario ("Todos los días pagando con…")
  if (promo.activo && /^(todos los|todas las|disfrut|pag[aá]\b|pagando|v[aá]lid|con tu|los (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados|domingos))/i.test((promo.localesAdheridos || '').trim())) {
    sinComercio.push(promo.id);
  }

  // 10. Niveles de cuenta/cliente (Patagonia, Supervielle)
  if (promo.niveles !== undefined) {
    if (!Array.isArray(promo.niveles) || promo.niveles.length < 2) {
      errors.push(`${prefix} niveles debe ser un array con al menos 2 niveles (si hay uno solo, usar porcentajeDescuento).`);
    } else {
      const nombres = new Set();
      promo.niveles.forEach(n => {
        if (!n.nivel || typeof n.nivel !== 'string') errors.push(`${prefix} Cada nivel requiere el nombre en "nivel".`);
        if (nombres.has(n.nivel)) errors.push(`${prefix} Nivel duplicado: ${n.nivel}`);
        nombres.add(n.nivel);
        if (typeof n.porcentaje !== 'number' || n.porcentaje <= 0 || n.porcentaje > 100) {
          errors.push(`${prefix} Nivel "${n.nivel}" con porcentaje inválido: ${n.porcentaje}`);
        }
        if (n.montoTope !== undefined && n.montoTope !== null && (typeof n.montoTope !== 'number' || n.montoTope <= 0)) {
          errors.push(`${prefix} Nivel "${n.nivel}" con montoTope inválido: ${n.montoTope}`);
        }
      });
      const piso = Math.min(...promo.niveles.map(n => n.porcentaje));
      if (promo.porcentajeDescuento !== piso) {
        errors.push(`${prefix} porcentajeDescuento (${promo.porcentajeDescuento}) debe ser el piso de los niveles (${piso}).`);
      }
    }
  }
});

// Advertencias no bloqueantes: promos activas ya vencidas o próximas a vencer
// Fecha local (Argentina), no UTC: a la noche toISOString() ya da el día siguiente y marcaba vencidas antes de tiempo
const fechaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = fechaLocal(new Date());
const en7 = fechaLocal(new Date(Date.now() + 7 * 86400000));
const vencidasActivas = promos.filter(p => p.activo && p.vigenciaHasta < hoy);
const porVencer = promos.filter(p => p.activo && p.vigenciaHasta >= hoy && p.vigenciaHasta <= en7);
if (vencidasActivas.length) console.warn(`⚠️  ${vencidasActivas.length} promos activas con vigencia vencida (el engine las oculta): ${vencidasActivas.map(p => p.id).join(', ')}`);
if (sinComercio.length) console.warn(`⚠️  ${sinComercio.length} promos activas sin el nombre del comercio en localesAdheridos (texto publicitario): ${sinComercio.join(', ')}`);
if (porVencer.length) console.warn(`⚠️  ${porVencer.length} promos activas vencen en los próximos 7 días.`);

if (errors.length > 0) {
  console.error('❌ Se encontraron errores de validación:');
  errors.forEach(err => console.error(` - ${err}`));
  process.exit(1);
} else {
  console.log('✅ Validación exitosa. Todas las promociones son consistentes y cumplen el esquema.');
}
