// Test suite para logic-agent
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Fixture CONGELADO del catálogo (septiembre 2026). Los tests validan el motor de recomendación, no los datos
// vivos: src/data/promos.json cambia cada mes (vigencias, topes, promos desactivadas) y romperia los asserts.
// La calidad de los datos reales la cubre `npm run validate-data`.
const promos = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/promos.snapshot.json'), 'utf8'));

// Clasificador real de formas de pago (TypeScript sin dependencias: Node 22.18+ lo importa directo)
const { formasDePago, puedePagar } = require('../../src/logic/formasPago.ts');
// Orden real del motor (mismo archivo que usa engine.ts)
const { compararPromos, compararGrupos, topeMensual, maxPorcentajeGeneral, mejorPorDia } = require('../../src/logic/orden.ts');

function getVarianteLabel(promo, allInBank) {
  const isNfc = /nfc|contactless/i.test(promo.medioPagoDetalle + ' ' + promo.condicionUso + ' ' + promo.id);
  const isCuenta = /dinero en cuenta/i.test(promo.medioPagoDetalle + ' ' + promo.condicionUso + ' ' + promo.id);
  const local = promo.localesAdheridos ? promo.localesAdheridos.trim() : '';

  const hasSameLocalDifferentMedium = allInBank.some(
    (other) =>
      other.id !== promo.id &&
      other.localesAdheridos === promo.localesAdheridos &&
      (/nfc/i.test(other.id) !== isNfc)
  );

  if (hasSameLocalDifferentMedium) {
    if (isNfc) return (local ? `${local} - ` : '') + 'Con NFC (Visa Crédito)';
    if (isCuenta) return (local ? `${local} - ` : '') + 'Con Dinero en cuenta / QR';
  }

  if (local && local !== 'Comercios adheridos') {
    if (isNfc) return `${local} (con NFC)`;
    if (isCuenta) return `${local} (con Dinero en cuenta)`;
    return local;
  }

  if (isNfc) return 'Con tecnología NFC (Contactless)';
  if (isCuenta) return 'Con Dinero en cuenta';
  return promo.medioPagoDetalle || 'Pago con QR / Tarjeta';
}

// Replicamos la función lógica para testear en node directamente
function testFindBestPromos(userBankIds, rubro, targetDate, allPromos, recursos = null) {
  const diaSemana = targetDate.getDay();
  const fechaIso = targetDate.toISOString().split('T')[0];

  if (!userBankIds || userBankIds.length === 0) {
    return { status: 'no_wallet', bestPromo: null, bestGroup: null, alternativeGroups: [] };
  }

  const userBankSet = new Set(userBankIds);
  const promosEnRubro = allPromos.filter(p => 
    p.activo && 
    p.rubro === rubro && 
    userBankSet.has(p.bancoBilleteraId) &&
    fechaIso >= p.vigenciaDesde && 
    fechaIso <= p.vigenciaHasta
  );
  const promosDelUsuario = promosEnRubro.filter(p => puedePagar(p, recursos));
  const ocultasHoy = promosEnRubro.filter(p => p.diasSemana.includes(diaSemana) && !puedePagar(p, recursos));

  const promosDeHoy = promosDelUsuario.filter(p => p.diasSemana.includes(diaSemana));

  promosDeHoy.sort(compararPromos);

  // Agrupación por banco/entidad
  const promosByBank = new Map();
  for (const promo of promosDeHoy) {
    const list = promosByBank.get(promo.bancoBilleteraId) || [];
    list.push(promo);
    promosByBank.set(promo.bancoBilleteraId, list);
  }

  const groupedPromos = [];
  for (const [bankId, promosList] of promosByBank.entries()) {
    const bestInBank = promosList[0];
    const maxPorcentaje = maxPorcentajeGeneral(promosList);

    const variantes = promosList.map((p) => ({
      id: p.id,
      etiquetaModalidad: getVarianteLabel(p, promosList),
      porcentajeDescuento: p.porcentajeDescuento,
      tipoTope: p.tipoTope,
      montoTope: p.montoTope,
      localesAdheridos: p.localesAdheridos,
    }));

    // Agrupación por niveles de descuento
    const byPct = new Map();
    for (const v of variantes) {
      const list = byPct.get(v.porcentajeDescuento) || [];
      list.push(v);
      byPct.set(v.porcentajeDescuento, list);
    }
    const niveles = [];
    const pcts = [...byPct.keys()].sort((a, b) => b - a);
    for (const pct of pcts) {
      const items = byPct.get(pct);
      const hasSinTope = items.some((i) => i.tipoTope === 'sin_tope');
      const maxTope = hasSinTope ? null : Math.max(...items.map((i) => i.montoTope || 0));
      niveles.push({
        porcentaje: pct,
        hasSinTope,
        maxTope,
        items,
      });
    }

    groupedPromos.push({
      bancoBilleteraId: bankId,
      bancoBilleteraNombre: bestInBank.bancoBilleteraNombre,
      rubro,
      maxPorcentaje,
      bestPromo: bestInBank,
      variantes,
      niveles,
      totalOpciones: promosList.length,
    });
  }

  groupedPromos.sort(compararGrupos);

  return {
    status: promosDeHoy.length > 0 ? 'ok' : 'no_promos_today',
    bestPromo: promosDeHoy[0] || null,
    alternativePromos: promosDeHoy.slice(1),
    bestGroup: groupedPromos[0] || null,
    alternativeGroups: groupedPromos.slice(1),
    total: promosDeHoy.length,
    ocultasPorFormaPago: {
      cantidad: ocultasHoy.length,
      maxPorcentaje: ocultasHoy.length ? Math.max(...ocultasHoy.map(p => p.porcentajeDescuento)) : null
    }
  };
}

console.log('🧪 Iniciando pruebas unitarias de logic-agent...\n');

// Test 1: Billetera vacía
{
  const res = testFindBestPromos([], 'supermercado', new Date(), promos);
  assert.strictEqual(res.status, 'no_wallet', 'Debe retornar status no_wallet si la billetera está vacía');
  assert.strictEqual(res.bestPromo, null);
  console.log('✔ Test 1 superado: Manejo correcto de billetera vacía.');
}

// Test 2: Filtro estricto de banco (REGLA SAGRADA)
{
  // Usuario solo tiene Cuenta DNI. Buscamos en combustible un viernes.
  // Banco Nación tiene 30% en combustible los viernes, pero el usuario NO tiene Banco Nación.
  const fechaViernes = new Date('2026-09-25T12:00:00Z'); // Viernes
  const res = testFindBestPromos(['cuenta-dni'], 'combustible', fechaViernes, promos);
  
  assert.strictEqual(res.status, 'no_promos_today', 'No debe recomendar Banco Nación si el usuario no lo tiene');
  assert.strictEqual(res.bestPromo, null);
  console.log('✔ Test 2 superado: Filtro estricto de billetera no filtra bancos ajenos.');
}

// Test 3: Recomendación óptima para el día
{
  // Usuario tiene Cuenta DNI y Banco Nación. Miércoles en supermercado.
  // Cuenta DNI tiene 20% tope $8.000 mes. BNA tiene 20% tope $10.000 semana.
  const fechaMiercoles = new Date('2026-09-23T12:00:00Z'); // Miércoles
  const res = testFindBestPromos(['cuenta-dni', 'banco-nacion'], 'supermercado', fechaMiercoles, promos);

  assert.strictEqual(res.status, 'ok');
  assert.ok(res.bestPromo !== null);
  // BNA desempata por tope ($10000 vs $8000)
  assert.strictEqual(res.bestPromo.bancoBilleteraId, 'banco-nacion');
  assert.strictEqual(res.bestPromo.porcentajeDescuento, 20);
  console.log('✔ Test 3 superado: Selección y desempate óptimo por porcentaje y tope.');
}

// Test 4: Sábado en carnicería con Cuenta DNI
{
  const fechaSabado = new Date('2026-09-26T12:00:00Z'); // Sábado
  const res = testFindBestPromos(['cuenta-dni'], 'carniceria', fechaSabado, promos);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.bestPromo.id, 'cdni-carnicerias-sab');
  assert.strictEqual(res.bestPromo.porcentajeDescuento, 35);
  console.log('✔ Test 4 superado: Promo Cuenta DNI 35% en carnicerías en día sábado.');
}

// Test 5: Lunes en supermercados con Cuenta DNI y Mercado Pago
{
  const fechaLunes = new Date('2026-09-21T12:00:00Z'); // Lunes
  const res = testFindBestPromos(['cuenta-dni', 'mercado-pago'], 'supermercado', fechaLunes, promos);
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(res.bestPromo.id, 'mp-super-mercadolibre-diario');
  assert.strictEqual(res.bestPromo.porcentajeDescuento, 35);
  assert.strictEqual(res.bestPromo.bancoBilleteraId, 'mercado-pago');
  console.log('✔ Test 5 superado: Mercado Pago 35% en Mercado Libre Supermercado recomendada como mejor opción en lunes por sobre Cuenta DNI 20%.');
}

// Test 6: Martes en supermercados con Cuenta DNI (Toledo y cadenas adheridas)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['cuenta-dni'], 'supermercado', fechaMartes, promos);
  assert.strictEqual(res.status, 'ok', 'Debe encontrar promociones activas para el martes');
  assert.strictEqual(res.bestPromo.id, 'cdni-super-toledo-nfc');
  assert.strictEqual(res.bestPromo.porcentajeDescuento, 20);
  assert.strictEqual(res.total, 3, 'Debe haber 3 promociones de supermercado activas el martes (Toledo NFC 20%, Toledo Cuenta 15%, Cadenas 15%)');
  console.log('✔ Test 6 superado: Cuenta DNI 20% en Toledo recomendada en martes con 3 opciones disponibles.');
}

// Test 7: Miércoles en supermercados con MODO y Cuenta DNI (Toledo 30% con MODO)
{
  const fechaMiercoles = new Date('2026-09-23T12:00:00Z'); // Miércoles
  const res = testFindBestPromos(['cuenta-dni', 'modo'], 'supermercado', fechaMiercoles, promos);
  assert.strictEqual(res.status, 'ok', 'Debe encontrar promociones activas para el miércoles');
  assert.strictEqual(res.bestPromo.id, 'modo-supermercados-toledo-sept26');
  assert.strictEqual(res.bestPromo.porcentajeDescuento, 30);
  assert.strictEqual(res.bestPromo.bancoBilleteraId, 'modo');
  assert.strictEqual(res.bestPromo.localesAdheridos, 'Toledo');
  console.log('✔ Test 7 superado: MODO 30% en Toledo recomendada como la #1 en miércoles superando a las de Cuenta DNI.');
}

// Test 8: Martes en supermercados con MODO (COTO 20% sin tope, Jumbo 20%, ChangoMás 20%, etc.)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['modo'], 'supermercado', fechaMartes, promos);
  assert.strictEqual(res.status, 'ok', 'Debe encontrar promociones activas para el martes con MODO');
  assert.strictEqual(res.total >= 7, true, 'Debe haber al menos 7 promociones de supermercado con MODO los martes');
  
  // Verificamos que COTO 20% sin tope esté en las promociones disponibles del martes
  const promoCoto = promos.find(p => p.id === 'modo-20-en-coto-septiembre-2608-745');
  assert.ok(promoCoto, 'La promoción de COTO Martes debe existir');
  assert.strictEqual(promoCoto.bancoBilleteraId, 'modo');
  assert.strictEqual(promoCoto.porcentajeDescuento, 20);
  assert.strictEqual(promoCoto.tipoTope, 'sin_tope');
  assert.strictEqual(promoCoto.diasSemana.includes(2), true);
  console.log('✔ Test 8 superado: MODO en supermercados los martes incluye COTO 20% sin tope, Jumbo 20%, ChangoMás 20% y alternativas.');
}

// Test 9: Agrupación en una sola tarjeta para MODO (7 opciones englobadas en 1 grupo)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['modo'], 'supermercado', fechaMartes, promos);
  assert.ok(res.bestGroup !== null, 'Debe existir bestGroup para MODO');
  assert.strictEqual(res.bestGroup.bancoBilleteraId, 'modo');
  assert.strictEqual(res.alternativeGroups.length, 0, 'No debe haber grupos alternativos si el usuario solo tiene MODO');
  assert.strictEqual(res.bestGroup.totalOpciones >= 7, true, 'El grupo de MODO debe contener todas las opciones (al menos 7)');
  assert.ok(res.bestGroup.variantes.some(v => v.localesAdheridos === 'COTO'), 'El desglose de MODO debe incluir COTO');
  assert.ok(res.bestGroup.variantes.some(v => v.localesAdheridos === 'Jumbo'), 'El desglose de MODO debe incluir Jumbo');
  console.log('✔ Test 9 superado: Agrupación de MODO en 1 sola tarjeta inteligente con 7 opciones desglosadas.');
}

// Test 10: Agrupación en una sola tarjeta para Cuenta DNI (desglose por modalidades NFC vs Dinero en cuenta)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['cuenta-dni'], 'supermercado', fechaMartes, promos);
  assert.ok(res.bestGroup !== null, 'Debe existir bestGroup para Cuenta DNI');
  assert.strictEqual(res.bestGroup.bancoBilleteraId, 'cuenta-dni');
  assert.strictEqual(res.bestGroup.totalOpciones, 3);
  assert.ok(res.bestGroup.variantes.some(v => v.etiquetaModalidad.includes('NFC')), 'Debe desglosar la variante NFC');
  assert.ok(res.bestGroup.variantes.some(v => v.etiquetaModalidad.includes('Dinero en cuenta')), 'Debe desglosar la variante Dinero en cuenta');
  console.log('✔ Test 10 superado: Agrupación de Cuenta DNI con desglose claro entre NFC y Dinero en cuenta.');
}

// Test 11: Usuario con Cuenta DNI y MODO recibe exactamente 2 tarjetas (1 ganadora y 1 alternativa)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['cuenta-dni', 'modo'], 'supermercado', fechaMartes, promos);
  assert.ok(res.bestGroup !== null);
  assert.strictEqual(res.alternativeGroups.length, 1, 'Debe haber exactamente 1 tarjeta alternativa en lugar de 9 tarjetas redundantes');
  console.log('✔ Test 11 superado: Agrupación multicard reduce 10 tarjetas repetidas a 2 tarjetas limpias y legibles.');
}

// Test 12: Agrupación interna por nivel de descuento (sin repetir cards con el mismo %)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['modo'], 'supermercado', fechaMartes, promos);
  assert.ok(res.bestGroup !== null);
  // Debe haber exactamente 3 niveles de descuento (25%, 20%, 10%)
  assert.strictEqual(res.bestGroup.niveles.length, 3, 'MODO debe tener exactamente 3 niveles de descuento');
  assert.strictEqual(res.bestGroup.niveles[0].porcentaje, 25);
  assert.strictEqual(res.bestGroup.niveles[1].porcentaje, 20);
  assert.strictEqual(res.bestGroup.niveles[2].porcentaje, 10);

  // El nivel 20% debe agrupar a COTO, Jumbo, ChangoMás y Lácteos El Milagro en una sola card/bloque
  const nivel20 = res.bestGroup.niveles[1];
  assert.strictEqual(nivel20.items.length, 4, 'El nivel 20% debe agrupar exactamente 4 comercios');
  assert.ok(nivel20.items.some(i => i.localesAdheridos === 'COTO'));
  assert.ok(nivel20.items.some(i => i.localesAdheridos === 'Jumbo'));
  assert.ok(nivel20.items.some(i => i.localesAdheridos === 'ChangoMás'));
  assert.ok(nivel20.items.some(i => i.localesAdheridos === 'Lacteos El Milagro'));

  // El nivel 10% debe agrupar a Almacor y Cordial en una sola card/bloque
  const nivel10 = res.bestGroup.niveles[2];
  assert.strictEqual(nivel10.items.length, 2, 'El nivel 10% debe agrupar exactamente 2 comercios');
  assert.ok(nivel10.items.some(i => i.localesAdheridos === 'Almacor'));
  assert.ok(nivel10.items.some(i => i.localesAdheridos === 'Cordial'));
  console.log('✔ Test 12 superado: Agrupación por nivel de descuento engloba todos los comercios del mismo porcentaje (ej. 4 comercios en 20%).');
}

// Test 13: Mercado Pago agrupa beneficios de la app en supermercados (35% Meli, 15% Changomas, 10% Sakim/Super A)
{
  const fechaMartes = new Date('2026-09-22T12:00:00Z'); // Martes (hoy)
  const res = testFindBestPromos(['mercado-pago'], 'supermercado', fechaMartes, promos);
  assert.ok(res.bestGroup !== null, 'Debe existir bestGroup para Mercado Pago');
  assert.strictEqual(res.bestGroup.bancoBilleteraId, 'mercado-pago');
  assert.strictEqual(res.bestGroup.maxPorcentaje, 35);
  assert.strictEqual(res.bestGroup.bestPromo.localesAdheridos, 'Mercado Libre');
  assert.ok(res.bestGroup.variantes.some(v => v.localesAdheridos === 'Changomas'), 'Debe incluir Changomas 15%');
  console.log('✔ Test 13 superado: Mercado Pago agrupa beneficios de la app con 35% en Mercado Libre y 15% en Changomas.');
}

// Test 14: Clasificador de formas de pago (lee medioPagoDetalle)
{
  assert.deepStrictEqual(formasDePago('Visa Crédito vía NFC en app Cuenta DNI (Android)'), ['NFC']);
  assert.deepStrictEqual(formasDePago('QR o Clave DNI'), ['QR', 'Clave DNI']);
  assert.deepStrictEqual(formasDePago('Tarjetas de crédito y débito vía QR MODO'), ['QR MODO']);
  assert.deepStrictEqual(formasDePago('Dinero en cuenta o NFC en app Cuenta DNI'), ['QR', 'NFC']);
  assert.deepStrictEqual(formasDePago('Visa Crédito'), ['Tarjeta']);
  // Sin responder (null) no se oculta nada; con una de sus formas alcanza
  assert.strictEqual(puedePagar({ medioPagoDetalle: 'Visa Débito vía NFC (Android)' }, null), true);
  assert.strictEqual(puedePagar({ medioPagoDetalle: 'Visa Débito vía NFC (Android)' }, ['app', 'tarjeta']), false);
  assert.strictEqual(puedePagar({ medioPagoDetalle: 'Dinero en cuenta o NFC en app Cuenta DNI' }, ['app']), true);
  assert.strictEqual(puedePagar({ medioPagoDetalle: 'Compras online en Mercado Libre' }, []), true);
  console.log('✔ Test 14 superado: El clasificador detecta NFC, QR, QR MODO, Clave DNI y tarjeta, y con una forma alcanza.');
}

// Test 15: Sin NFC, el 30% de Mostaza (solo Android con NFC) no se recomienda y queda contado como oculto
{
  const jueves = new Date('2026-10-01T12:00:00Z'); // Jueves
  const conTodo = testFindBestPromos(['cuenta-dni'], 'gastronomia', jueves, promos);
  assert.strictEqual(conTodo.bestPromo.id, 'cdni-gastro-mostaza-nfc', 'Sin responder, la mejor es Mostaza 30% NFC');
  assert.strictEqual(conTodo.ocultasPorFormaPago.cantidad, 0);

  const sinNfc = testFindBestPromos(['cuenta-dni'], 'gastronomia', jueves, promos, ['app', 'tarjeta']);
  const ids = [sinNfc.bestPromo, ...sinNfc.alternativePromos].filter(Boolean).map(p => p.id);
  assert.ok(!ids.includes('cdni-gastro-mostaza-nfc'), 'Sin NFC no debe recomendarse Mostaza NFC');
  assert.ok(ids.every(id => puedePagar(promos.find(p => p.id === id), ['app', 'tarjeta'])));
  assert.ok(sinNfc.ocultasPorFormaPago.cantidad >= 1);
  assert.strictEqual(sinNfc.ocultasPorFormaPago.maxPorcentaje, 30);
  console.log('✔ Test 15 superado: Sin NFC no se recomiendan promos solo NFC y se informa cuántas quedaron afuera (hasta 30%).');
}

// Test 16: El filtro de forma de pago nunca suma bancos fuera de la billetera
{
  const jueves = new Date('2026-10-01T12:00:00Z');
  const res = testFindBestPromos(['cuenta-dni'], 'supermercado', jueves, promos, ['app']);
  const todas = [res.bestPromo, ...res.alternativePromos].filter(Boolean);
  assert.ok(todas.every(p => p.bancoBilleteraId === 'cuenta-dni'));
  assert.ok(todas.some(p => p.id === 'cdni-super-changomas-jue'), 'Changomás también se paga con la app (dinero en cuenta)');
  assert.ok(!todas.some(p => p.id === 'cdni-super-coto-nfc'), 'COTO solo NFC no debe aparecer');
  console.log('✔ Test 16 superado: Con solo la app se mantienen las promos QR/cuenta y se ocultan las solo NFC, sin salir de la billetera.');
}

// Test 17: Los topes se comparan llevados a un mes ($6.000 por semana le gana a $10.000 por mes)
{
  assert.strictEqual(topeMensual({ tipoTope: 'por_semana', montoTope: 6000 }), 24000);
  assert.strictEqual(topeMensual({ tipoTope: 'por_dia', montoTope: 5000 }), 150000);
  assert.strictEqual(topeMensual({ tipoTope: 'sin_tope', montoTope: null }), Infinity);
  const base = { bancoBilleteraNombre: 'X', porcentajeDescuento: 15, minimoCompra: null };
  const semanal = { ...base, id: 'a', tipoTope: 'por_semana', montoTope: 6000 };
  const mensual = { ...base, id: 'b', tipoTope: 'por_mes', montoTope: 10000 };
  assert.ok(compararPromos(semanal, mensual) < 0, '$6.000 por semana debe ir antes que $10.000 por mes');
  console.log('✔ Test 17 superado: Los topes de distinto período se comparan en su equivalente mensual.');
}

// Test 18: Un empate real (mismo %, tope y mínimo) se ordena siempre igual, sin importar el orden de carga
{
  const promo = (id, nombre) => ({ id, bancoBilleteraNombre: nombre, porcentajeDescuento: 30, tipoTope: 'por_semana', montoTope: 12000, minimoCompra: null });
  const grupo = (nombre, opciones) => ({ bancoBilleteraNombre: nombre, totalOpciones: opciones, bestPromo: promo(nombre, nombre) });
  const a = [grupo('MODO', 3), grupo('Banco Galicia', 3), grupo('Banco Supervielle', 2)];
  const b = [a[2], a[0], a[1]];
  const ordenA = [...a].sort(compararGrupos).map(g => g.bancoBilleteraNombre);
  const ordenB = [...b].sort(compararGrupos).map(g => g.bancoBilleteraNombre);
  assert.deepStrictEqual(ordenA, ordenB, 'El orden no debe depender del orden de carga');
  assert.deepStrictEqual(ordenA, ['Banco Galicia', 'MODO', 'Banco Supervielle'], 'Empate: más opciones primero y después el nombre');
  console.log('✔ Test 18 superado: Los empates se desempatan por cantidad de opciones y nombre, siempre en el mismo orden.');
}

// Test 19: Una promo de alcance limitado (feria puntual al 40%) no le gana a una general (20% en cualquier almacén)
{
  const base = { bancoBilleteraNombre: 'Cuenta DNI', tipoTope: 'por_semana', montoTope: 6000, minimoCompra: null };
  const feria = { ...base, id: 'feria', porcentajeDescuento: 40, alcanceLimitado: true };
  const almacen = { ...base, id: 'almacen', porcentajeDescuento: 20 };
  assert.deepStrictEqual([feria, almacen].sort(compararPromos).map(p => p.id), ['almacen', 'feria']);
  assert.strictEqual(maxPorcentajeGeneral([feria, almacen]), 20, 'El "hasta X%" usa las promos generales');
  assert.strictEqual(maxPorcentajeGeneral([feria]), 40, 'Si solo hay de alcance limitado, cuenta esa');
  console.log('✔ Test 19 superado: Las promos de alcance limitado van después de las generales y no inflan el "hasta X%".');
}

// Test 20: "Otros días" mira la vigencia en la fecha de cada día (una promo que vence hoy no aparece el jueves)
{
  const promo = (id, hasta) => ({ id, bancoBilleteraNombre: 'MODO', porcentajeDescuento: 20, tipoTope: 'por_mes', montoTope: 5000, minimoCompra: null, diasSemana: [4], vigenciaDesde: '2026-09-01', vigenciaHasta: hasta });
  const miercoles = new Date(2026, 8, 30, 12); // 30/9/2026, hora local
  assert.deepStrictEqual(mejorPorDia([promo('vence-hoy', '2026-09-30')], miercoles), [], 'Vence el 30/9: no puede ofrecerse para el jueves 1/10');
  const r = mejorPorDia([promo('sigue', '2026-10-31')], miercoles);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].diaSemana, 4);
  console.log('✔ Test 20 superado: Los próximos días con descuento respetan la vigencia de cada fecha.');
}

console.log('\n🎉 Todas las pruebas unitarias de logic-agent pasaron con éxito.');
