const cheerio = require('cheerio');
const fs = require('fs');

async function fetchRetry(url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 600 * i));
    }
  }
}

async function analyzeAll() {
  const BASE_URL = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios/';
  const DETAIL_API_URL = 'https://www.bancoprovincia.com.ar/cuentadni/Home/GetBeneficioData2?idBeneficio=';

  console.log('Fetching main page...');
  const res = await fetchRetry(BASE_URL);
  const html = await res.text();
  const $ = cheerio.load(html);

  const cards = $('.callModalCDNI');
  console.log(`Found ${cards.length} cards.`);

  const allBenefits = [];

  for (let i = 0; i < cards.length; i++) {
    const el = cards[i];
    const rawId = $(el).attr('id') || '';
    const idNumMatch = rawId.match(/(\d+)$/);
    const idBeneficio = idNumMatch ? idNumMatch[1] : null;

    const titulo = $(el).find('.tituloBeneficio').text().replace(/\s+/g, ' ').trim();
    const diasTexto = $(el).find('.BEN_CON_dias').text().replace(/\s+/g, ' ').trim();
    const pctText = $(el).find('.BEN_CON_nro').text().trim();
    const imgAlts = $(el).find('img').map((_, img) => $(img).attr('alt') || $(img).attr('src') || '').get().join(' | ');

    let detail = null;
    if (idBeneficio) {
      try {
        const dRes = await fetchRetry(`${DETAIL_API_URL}${idBeneficio}`);
        if (dRes && dRes.ok) {
          const json = await dRes.json();
          detail = json.Entity;
        }
      } catch (err) {
        console.error(`Failed to fetch detail for ${idBeneficio}:`, err.message);
      }
    }

    allBenefits.push({
      cardIndex: i,
      rawId,
      idBeneficio,
      titulo,
      diasTexto,
      pctText,
      imgAlts,
      beneficio: detail?.Beneficio,
      condiciones: detail?.Condiciones
    });
  }

  fs.writeFileSync('scripts/reports/cdni-full-audit.json', JSON.stringify(allBenefits, null, 2));
  console.log(`Saved ${allBenefits.length} benefits to scripts/reports/cdni-full-audit.json`);
}

analyzeAll();
