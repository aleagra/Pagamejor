const fs = require('fs');

const SLOTS = [
  { name: 'Supermercados', slug: 'web-modo-hub-supermercados', url: 'https://www.modo.com.ar/promos/slot/web-modo-hub-supermercados' },
  { name: 'Destacadas', slug: 'web-modo-hub-destacadas', url: 'https://www.modo.com.ar/promos/slot/web-modo-hub-destacadas' },
  { name: 'Exclusivas Online', slug: 'web-modo-hub-exclusivas-online', url: 'https://www.modo.com.ar/promos/slot/web-modo-hub-exclusivas-online' },
  { name: 'Financiación', slug: 'web-modo-hub-promos-financiacion', url: 'https://www.modo.com.ar/promos/slot/web-modo-hub-promos-financiacion' }
];

async function fetchSlot(slotSlug) {
  const url = `https://www.modo.com.ar/promos/api/rewards/slots?slots=${slotSlug}&banks=&user_bank_ids=&limit=50&page=1&fcalcstatus=running%2Cfinished_for_product%2Cnext_for_product&slot_info=true`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data?.cards || [];
}

async function run() {
  console.log('Iniciando auditoría de los 4 slots de MODO...');
  const auditResults = {};

  for (const slot of SLOTS) {
    console.log(`\nSlot: ${slot.name} (${slot.slug})...`);
    try {
      const cards = await fetchSlot(slot.slug);
      console.log(` -> ${cards.length} promociones encontradas.`);
      auditResults[slot.slug] = {
        name: slot.name,
        url: slot.url,
        total: cards.length,
        cards
      };
    } catch (e) {
      console.error(`Error en slot ${slot.slug}:`, e.message);
    }
  }

  fs.writeFileSync('scripts/reports/modo-slots-audit.json', JSON.stringify(auditResults, null, 2), 'utf8');
  console.log('\nReporte guardado en scripts/reports/modo-slots-audit.json');
}

run();
