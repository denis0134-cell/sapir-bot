function parseNaturalCommand(text) {
  const t = text.toLowerCase();
  if (!t.includes('הצע') && !t.includes('proposal') && !t.includes('תייצר') && !t.includes('לשלוח')) return null;
  const phoneMatch = text.match(/(?:97[2]|0)([5][0-9]{8}|[2-9][0-9]{7})/);
  if (!phoneMatch) return null;
  const rawPhone = phoneMatch[0];
  const phone = rawPhone.startsWith('0') ? '972' + rawPhone.slice(1) : rawPhone;
  let program = 'BOTH';
  if (/abm\+ldb|שניהם|הכל|משולב|both/i.test(text)) program = 'ABM+LDB';
  else if (/\babm\b/i.test(text)) program = 'ABM';
  else if (/\bldb\b/i.test(text)) program = 'LDB';
  const priceMatch = text.match(/(\d{4,6})/);
  const defaultPrices = { 'ABM': '13900', 'LDB': '18900', 'BOTH': '24900', 'ABM+LDB': '24900' };
  const price = priceMatch ? priceMatch[1] : defaultPrices[program];
  return { phone, program, price };
}

module.exports = { parseNaturalCommand };
