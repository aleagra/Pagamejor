const fs = require('fs');
const path = require('path');

const audit = JSON.parse(fs.readFileSync('scripts/reports/modo-slots-audit.json', 'utf8'));

// Nombres de días en español
const NOMBRES_DIAS = [
  'Domingos',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábados'
];

function parseDays(dowStr) {
  if (!dowStr || typeof dowStr !== 'string') {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const map = {
    'D': 0,
    'L': 1,
    'M': 2,
    'X': 3,
    'J': 4,
    'V': 5,
    'S': 6
  };
  const dias = [];
  for (const char of dowStr) {
    if (map[char] !== undefined && !dias.includes(map[char])) {
      dias.push(map[char]);
    }
  }
  return dias.length > 0 ? dias.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

function formatDaysText(dias) {
  if (dias.length === 7) return 'Todos los días';
  if (dias.length === 1) return NOMBRES_DIAS[dias[0]];
  if (dias.length === 2 && dias.includes(6) && dias.includes(0)) return 'Sábados y Domingos';
  if (dias.length === 2 && dias.includes(5) && dias.includes(6)) return 'Viernes y Sábados';
  if (dias.length === 2 && dias.includes(2) && dias.includes(4)) return 'Martes y Jueves';
  if (dias.length === 2 && dias.includes(1) && dias.includes(3)) return 'Lunes y Miércoles';
  if (dias.length === 2 && dias.includes(1) && dias.includes(4)) return 'Lunes y Jueves';
  if (dias.length === 2 && dias.includes(3) && dias.includes(4)) return 'Miércoles y Jueves';
  return dias.map(d => NOMBRES_DIAS[d]).join(', ');
}

function determineRubro(card, commerce, tags) {
  const slot = card.slotName || '';
  const searchStr = `${commerce} ${tags} ${card.title || ''} ${card.short_description || ''}`.toLowerCase();

  if (slot === 'Supermercados') {
    if (searchStr.includes('mayorista') && !searchStr.includes('barrio')) {
      return 'mayorista';
    }
    return 'supermercado';
  }

  // Combustible
  if (/combustible|ypf|shell|axion|puma|estacion/i.test(searchStr)) {
    return 'combustible';
  }

  // Farmacia
  if (/farmac|farma|perfumeri|simplicity|selma|puente|vilela|central oeste|get the look/i.test(searchStr)) {
    return 'farmacia';
  }

  // Gastronomía
  if (/restaurante|parrilla|heladeria|smart|vacalin|la emilia|san honorato|naranjos|tressen|el paso|milveintiuno|agape|eleton|quotidiano|food market|food/i.test(searchStr)) {
    return 'gastronomia';
  }

  // Indumentaria / Deportes
  if (/sporting|woker|topper|seven sport|showsport|champion|mizuno|under armour|amaringa|lazaro|bensimon|ruiz y roca|indumentaria|moda|exty|bikinis|legion extranjera/i.test(searchStr)) {
    return 'indumentaria';
  }

  // Mascotas
  if (/veterinaria|pet/i.test(searchStr)) {
    return 'mascotas';
  }

  // Librerías / Jugueterías
  if (/jugueter|creciendo|librer/i.test(searchStr)) {
    return 'libreria';
  }

  // Hogar
  if (/arredo|garden life|gardenlife|rex|essen|simmons|belmo|psa/i.test(searchStr)) {
    return 'hogar';
  }

  // Tecnología
  if (/compragamer|compra gamer|bidcom|oncity|on city|fravega|tienda ciudad|icbc mall/i.test(searchStr)) {
    return 'tecnologia';
  }

  // Entretenimiento
  if (/creamfields|parense de manos|quilmes rock|entretenimiento|cine|teatro/i.test(searchStr)) {
    return 'entretenimiento';
  }

  // Supermercado si coincide
  if (/supermercado|coto|changomas|jumbo|disco|vea|makro|toledo|dia|cooperativa obrera|la anonima|josimar/i.test(searchStr)) {
    return 'supermercado';
  }

  return 'otros';
}

function determineBank(bankStr) {
  const b = (bankStr || '').trim();
  if (!b || b === 'Bancos adheridos') {
    return { id: 'modo', nombre: 'MODO' };
  }
  if (b.includes('BNA') || b.includes('Banco Nación')) {
    return { id: 'banco-nacion', nombre: 'Banco Nación (BNA)' };
  }
  if (b.includes('Macro')) {
    return { id: 'banco-macro', nombre: 'Banco Macro' };
  }
  if (b.includes('BBVA')) {
    return { id: 'bbva', nombre: 'Banco BBVA' };
  }
  if (b.includes('Galicia')) {
    return { id: 'galicia', nombre: 'Banco Galicia' };
  }
  if (b.includes('Santander')) {
    return { id: 'santander', nombre: 'Banco Santander' };
  }
  if (b.includes('Ciudad') || b.includes('Buepp')) {
    return { id: 'banco-ciudad', nombre: 'Banco Ciudad' };
  }
  if (b.includes('Credicoop')) {
    return { id: 'banco-credicoop', nombre: 'Banco Credicoop' };
  }
  if (b.includes('Supervielle')) {
    return { id: 'supervielle', nombre: 'Banco Supervielle' };
  }
  if (b.includes('ICBC') || b.includes('YOY')) {
    return { id: 'icbc', nombre: 'Banco ICBC' };
  }
  if (b.includes('Comafi')) {
    return { id: 'banco-comafi', nombre: 'Banco Comafi' };
  }
  if (b.includes('Hipotecario')) {
    return { id: 'banco-hipotecario', nombre: 'Banco Hipotecario' };
  }
  if (b.includes('Corrientes')) {
    return { id: 'banco-corrientes', nombre: 'Banco de Corrientes' };
  }
  return { id: 'modo', nombre: 'MODO' };
}

// Consolidador
const allCards = [];
const seenSlugs = new Set();

for (const [slotKey, slotData] of Object.entries(audit)) {
  for (const c of slotData.cards) {
    if (!seenSlugs.has(c.slug)) {
      seenSlugs.add(c.slug);
      allCards.push({ ...c, slotName: slotData.name });
    }
  }
}

console.log(`Tarjetas únicas analizadas: ${allCards.length}`);

const generatedPromos = [];

for (const card of allCards) {
  const row = card.content?.row || [];
  const commerce = (row[0]?.text?.trim() || card.where || card.title || '').trim();
  const pctText = (row[1]?.text?.trim() || '').trim();
  const capText = (row[4]?.text?.trim() || '0').trim();
  const bankText = (row[5]?.text?.trim() || 'Bancos adheridos').trim();

  // Extraer porcentaje
  let pct = null;
  const matchPct = (pctText + ' ' + (card.title || '')).match(/(\d+)%/);
  if (matchPct) {
    pct = parseInt(matchPct[1]);
  } else if (/hasta 100%|100%/i.test(pctText)) {
    pct = 100;
  }

  // Si no tiene porcentaje de descuento (es solo cuotas o sorteo sin % reintegro),
  // nos concentramos en las promociones con reintegro determinístico según el motor de PagaMejor.
  if (!pct || pct <= 0) {
    continue;
  }

  const bank = determineBank(bankText);
  const rubro = determineRubro(card, commerce, card.search_tags || '');
  const dias = parseDays(card.days_of_week);
  const diasTexto = formatDaysText(dias);

  // Topes
  let capNum = parseInt(capText) || 0;
  // Caso especial COTO: en MODO legales "sin tope de reintegro"
  if (card.slug.includes('coto')) {
    capNum = 0;
  }

  const tipoTope = capNum > 0 ? (card.slug.includes('toledo') ? 'por_semana' : 'por_mes') : 'sin_tope';
  const montoTope = capNum > 0 ? capNum : null;
  const montoGastoOptimo = (capNum > 0 && pct > 0) ? Math.round(capNum / (pct / 100)) : null;

  // Fechas de vigencia
  let vigenciaDesde = card.start_date ? card.start_date.slice(0, 10) : '2026-09-01';
  let vigenciaHasta = card.stop_date ? card.stop_date.slice(0, 10) : '2026-10-31';

  // Si vigenciaHasta ya pasó o es anterior a sept 2026, la ajustamos a fin de mes si el estado es RUNNING
  if (vigenciaHasta < '2026-09-22' && card.calculated_status === 'RUNNING') {
    vigenciaHasta = '2026-10-31';
  }

  // Medio de pago
  const hasDebit = Array.isArray(card.debit_list) && card.debit_list.length > 0;
  const hasCredit = Array.isArray(card.credit_list) && card.credit_list.length > 0;
  const tipoMedioRequerido = (hasDebit && hasCredit) ? 'cualquiera' : (hasCredit ? 'credito' : (hasDebit ? 'debito' : 'cualquiera'));

  let medioPagoDetalle = 'Tarjetas de Crédito o Débito vía QR en app MODO o app bancaria adherida';
  if (card.payment_flow === 'online') {
    medioPagoDetalle = 'Tarjetas de Crédito o Débito en tienda online pagando con botón MODO';
  } else if (card.payment_flow === 'instore,online') {
    medioPagoDetalle = 'Tarjetas de Crédito o Débito en locales físicos o tienda online vía MODO';
  }

  if (bank.id !== 'modo') {
    medioPagoDetalle += ` con ${bank.nombre}`;
  }

  // Condicion de uso
  let condicionUso = 'Escanear el código QR en línea de caja con la app MODO o tu app bancaria adherida y abonar con tarjeta vinculada.';
  if (card.payment_flow === 'online') {
    condicionUso = 'Seleccionar el botón de pago MODO en el checkout de la tienda online o escanear el QR en pantalla.';
  }

  // Aclaraciones
  let topeStr = capNum > 0 ? `Tope de reintegro de $${capNum.toLocaleString('es-AR')}.` : 'Sin tope de reintegro.';
  let cuotasStr = pctText.includes('cuotas') || pctText.includes('CSI') ? ' Incluye financiación en cuotas sin interés.' : '';
  let aclaraciones = `${pct}% de ahorro los días ${diasTexto.toLowerCase()} en ${commerce}. ${topeStr}${cuotasStr} Promoción válida pagando a través de MODO con entidades adheridas.`;

  const promoId = `modo-${card.slug}`;

  generatedPromos.push({
    id: promoId,
    bancoBilleteraId: bank.id,
    bancoBilleteraNombre: bank.nombre,
    tipoMedioRequerido,
    medioPagoDetalle,
    rubro,
    diasSemana: dias,
    diasTexto,
    vigenciaDesde,
    vigenciaHasta,
    porcentajeDescuento: pct,
    tipoTope,
    montoTope,
    minimoCompra: null,
    montoGastoOptimo,
    condicionUso,
    localesAdheridos: commerce,
    aclaraciones,
    fuenteUrl: `https://www.modo.com.ar/promos/${card.slug}`,
    activo: true
  });
}

console.log(`Promociones MODO con reintegro generadas: ${generatedPromos.length}`);

// Guardar resultado previo
fs.writeFileSync('scripts/reports/generated-modo-promos.json', JSON.stringify(generatedPromos, null, 2), 'utf8');

// Mostrar distribución por día y rubro
const byDay = {};
const byRubro = {};
const byBank = {};

generatedPromos.forEach(p => {
  byRubro[p.rubro] = (byRubro[p.rubro] || 0) + 1;
  byBank[p.bancoBilleteraId] = (byBank[p.bancoBilleteraId] || 0) + 1;
  p.diasSemana.forEach(d => {
    byDay[NOMBRES_DIAS[d]] = (byDay[NOMBRES_DIAS[d]] || 0) + 1;
  });
});

console.log('\nDistribución por Rubro:', byRubro);
console.log('Distribución por Banco:', byBank);
console.log('Distribución por Día:', byDay);

// Mostrar promociones de MARTES en Supermercados
const martesSuper = generatedPromos.filter(p => p.rubro === 'supermercado' && p.diasSemana.includes(2) && p.bancoBilleteraId === 'modo');
console.log(`\nPromociones MODO de MARTES en Supermercados (${martesSuper.length}):`);
martesSuper.forEach(p => {
  console.log(`- ${p.localesAdheridos}: ${p.porcentajeDescuento}% (Tope: ${p.montoTope ? '$' + p.montoTope : 'SIN TOPE'})`);
});
