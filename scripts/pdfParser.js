// scripts/pdfParser.js
export async function parseGamePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\\n';
  }
  // Тепер з text витягуємо рядки з таблиці статистики...
  const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
  const records = [];
  for (const line of lines) {
    const parts = line.split(/\\s+/);
    // Наприклад, якщо ваш рядок: "Komar 10 5 100 80 80%"
    if (parts.length >= 6) {
      const [nick, kills, deaths, shots, hits, accRaw] = parts;
      const accuracy = parseFloat(accRaw.replace('%',''));
      records.push({
        nick,
        kills: parseInt(kills,10),
        deaths: parseInt(deaths,10),
        shots: parseInt(shots,10),
        hits: parseInt(hits,10),
        accuracy
      });
    }
  }
  return records;
}
