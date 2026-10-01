const fs = require('fs');

const audit = JSON.parse(fs.readFileSync('scripts/reports/modo-slots-audit.json', 'utf8'));

// Cadenas y comercios confirmados con presencia física en Mar del Plata
const COMERCIOS_MDP_PRESENCIAL = [
  'toledo',
  'cooperativa obrera',
  'cooperativaobrera',
  'dia',
  'superdia',
  'disco',
  'vea',
  'changomas',
  'chango mas',
  'diarco',
  'makro',
  'ypf',
  'farmacia',
  'veterinaria',
  'pet shop',
  'mostaza',
  'combustible',
  'transporte'
];

// Comercios netamente regionales de OTRAS provincias (NO en Mar del Plata)
const COMERCIOS_NO_MDP = [
  'alvear', // Santa Fe
  'atomo', // Cuyo / Mendoza
  'la anonima', // Patagonia / Interior
  'el tunel', // Santa Fe
  'supercoop', // CABA
  'petrelli', // Buenos Aires norte
  'maricre', // Santa Fe
  'la banderita', // Córdoba
  'kilbel', // Santa Fe
  'la reina', // Rosario
  'chalita', // Tucumán / Norte
  'almacor', // Córdoba
  'jk', // Regional
  'cereales diamante', // Entre Ríos
  'supers de mendoza', // Mendoza
  'proveedurias', // Santa Fe / Rosario
  'supermercadostodo', // Bariloche
  'corrientes', // Corrientes
  'changomas-lapampa', // La Pampa
  'supers de cordoba', // Córdoba
  'basualdo', // San Juan
  'supers federal', // Entre Ríos
  'cordial', // Cuyo
  'lacteos el milagro', // Córdoba
  'super cristian', // Santa Fe
  'super veloz', // Misiones
  'supers de jujuy', // Jujuy
  'pinguino', // Rafaela
  'diarco pueblo', // Localidades específicas
  'delca', // Córdoba
  'la ilusion', // Buenos Aires interior
  'distribuidora popular' // Regional
];

function checkMarDelPlata(promo, slotSlug) {
  const title = (promo.title || '').toLowerCase();
  const slug = (promo.slug || '').toLowerCase();
  const shortDesc = (promo.short_description || '').toLowerCase();
  const where = (promo.where || '').toLowerCase();
  const row0 = (promo.content?.row?.[0]?.text || '').toLowerCase();
  const textCombo = `${title} ${slug} ${shortDesc} ${where} ${row0}`;

  // Si es slot online, aplica a todo el país
  if (slotSlug === 'web-modo-hub-exclusivas-online' || (promo.payment_flow && promo.payment_flow.includes('online'))) {
    return { enMDP: true, motivo: 'Válido para Mar del Plata (Compra Online nacional)' };
  }

  // Chequeo de exclusión regional explícita
  for (const noMdp of COMERCIOS_NO_MDP) {
    if (textCombo.includes(noMdp)) {
      return { enMDP: false, motivo: `Regional exclusivo de otra provincia (${noMdp.toUpperCase()})` };
    }
  }

  // Chequeo de presencia confirmada en MDP
  for (const mdp of COMERCIOS_MDP_PRESENCIAL) {
    if (textCombo.includes(mdp)) {
      return { enMDP: true, motivo: `Sucursal física presente en Mar del Plata (${mdp.toUpperCase()})` };
    }
  }

  // Si es promo general de rubro (ej. Farmacias, Veterinarias, Combustible)
  if (textCombo.includes('farmacia') || textCombo.includes('veterinaria') || textCombo.includes('combustible') || textCombo.includes('transporte')) {
    return { enMDP: true, motivo: 'Comercios del rubro adheridos en Mar del Plata' };
  }

  return { enMDP: false, motivo: 'Comercio regional sin sucursal física en Mar del Plata' };
}

function parseDias(daysStr) {
  if (!daysStr) return 'Todos los días';
  const mapa = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' };
  const dias = [];
  for (const c of daysStr) {
    if (mapa[c]) dias.push(mapa[c]);
  }
  return dias.length > 0 ? dias.join(', ') : 'Todos los días';
}

function parseBanco(promo) {
  const row5 = promo.content?.row?.[5]?.text || '';
  const banks = promo.content?.row?.[5]?.extra_data || [];
  if (banks.length > 0 && banks[0].name_bank) return banks[0].name_bank;
  if (row5.trim()) return row5.trim();
  const slug = (promo.slug || '').toLowerCase();
  if (slug.includes('comafi')) return 'Banco Comafi';
  if (slug.includes('supervielle')) return 'Banco Supervielle';
  if (slug.includes('icbc')) return 'Banco ICBC';
  if (slug.includes('galicia')) return 'Banco Galicia';
  if (slug.includes('santander')) return 'Banco Santander';
  if (slug.includes('bbva')) return 'Banco BBVA';
  if (slug.includes('bna') || slug.includes('nacion')) return 'Banco Nación (BNA)';
  if (slug.includes('macro')) return 'Banco Macro';
  if (slug.includes('ciudad')) return 'Banco Ciudad';
  if (slug.includes('credicoop')) return 'Banco Credicoop';
  return 'Bancos adheridos a MODO';
}

const report = {
  fechaAuditoria: new Date().toISOString(),
  resumen: {},
  slots: {}
};

for (const [slotSlug, slotData] of Object.entries(audit)) {
  const promosMDP = [];
  const promosNoMDP = [];

  slotData.cards.forEach(c => {
    const mdpCheck = checkMarDelPlata(c, slotSlug);
    const banco = parseBanco(c);
    const dias = parseDias(c.days_of_week);
    const pct = c.content?.row?.[1]?.text || c.title || '';
    const tope = c.content?.row?.[4]?.text ? `$${c.content.row[4].text}` : 'Consultar legales';
    const comercio = c.content?.row?.[0]?.text?.trim() || c.where || c.title;
    
    // Vigencia
    const vigenciaDesde = c.start_date ? c.start_date.slice(0, 10) : '';
    const vigenciaHasta = c.stop_date ? c.stop_date.slice(0, 10) : '';
    const status = c.calculated_status || c.status;

    const itemObj = {
      id: c.promo_id || c.id,
      slug: c.slug,
      titulo: c.title,
      comercio,
      banco,
      beneficio: pct,
      tope,
      dias,
      vigencia: `${vigenciaDesde} al ${vigenciaHasta}`,
      status,
      modalidad: c.payment_flow || 'instore',
      url: `https://www.modo.com.ar/promos/${c.slug}`,
      motivoMDP: mdpCheck.motivo
    };

    if (mdpCheck.enMDP) {
      promosMDP.push(itemObj);
    } else {
      promosNoMDP.push(itemObj);
    }
  });

  report.slots[slotSlug] = {
    nombre: slotData.name,
    totalSlot: slotData.cards.length,
    totalAplicaMDP: promosMDP.length,
    totalNoAplicaMDP: promosNoMDP.length,
    promosMarDelPlata: promosMDP,
    promosExcluidas: promosNoMDP
  };
}

fs.writeFileSync('scripts/reports/modo-mdp-analysis.json', JSON.stringify(report, null, 2), 'utf8');
console.log('Análisis finalizado y guardado en scripts/reports/modo-mdp-analysis.json');
