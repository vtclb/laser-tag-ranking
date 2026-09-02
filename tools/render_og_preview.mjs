import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');

const outputPath = fileURLToPath(new URL('../v2/assets/og-varta-ranking-v2.png', import.meta.url));

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#1a2940" stroke-width="1" opacity="0.42"/>
    </pattern>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101a2b"/>
      <stop offset="1" stop-color="#090f1d"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#080d19"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#2b3a55" stroke-width="2"/>

  <rect x="48" y="48" width="1104" height="52" fill="#090f1b" stroke="#263650"/>
  <rect x="68" y="67" width="12" height="12" fill="#9dea38"/>
  <text x="94" y="81" fill="#f3f6fb" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">ВАРТА КЛУБ</text>
  <text x="1128" y="81" fill="#6fd3e8" font-family="Consolas, monospace" font-size="15" text-anchor="end">RANKING NODE / ONLINE</text>

  <text x="600" y="210" fill="#f4f6fa" font-family="Arial Narrow, Arial, sans-serif" font-size="78" font-weight="800" text-anchor="middle">ЛАЗЕРТАГ РЕЙТИНГ</text>
  <text x="600" y="255" fill="#6fd3e8" font-family="Consolas, monospace" font-size="21" font-weight="700" letter-spacing="2" text-anchor="middle">РЕЙТИНГОВА СИСТЕМА КЛУБУ</text>

  <line x1="112" y1="292" x2="1088" y2="292" stroke="#2b3a55" stroke-width="2"/>
  <line x1="112" y1="292" x2="392" y2="292" stroke="#6fd3e8" stroke-width="4"/>

  <g transform="translate(88 330)">
    <rect width="1024" height="162" fill="url(#panel)" stroke="#263650" stroke-width="2"/>
    <text x="28" y="36" fill="#74839c" font-family="Consolas, monospace" font-size="15">СИСТЕМА ВІДСТЕЖУЄ</text>

    <g transform="translate(28 58)">
      <rect width="296" height="76" fill="#0c1321" stroke="#2b3a55"/>
      <text x="20" y="29" fill="#9dea38" font-family="Consolas, monospace" font-size="15" font-weight="700">01 / ГРАВЦІ</text>
      <text x="20" y="55" fill="#f4f6fa" font-family="Arial, sans-serif" font-size="20" font-weight="700">РЕЙТИНГ І ПРОФІЛІ</text>
    </g>
    <g transform="translate(364 58)">
      <rect width="296" height="76" fill="#0c1321" stroke="#2b3a55"/>
      <text x="20" y="29" fill="#6fd3e8" font-family="Consolas, monospace" font-size="15" font-weight="700">02 / СЕЗОНИ</text>
      <text x="20" y="55" fill="#f4f6fa" font-family="Arial, sans-serif" font-size="20" font-weight="700">МАТЧІ ТА АРХІВ</text>
    </g>
    <g transform="translate(700 58)">
      <rect width="296" height="76" fill="#0c1321" stroke="#2b3a55"/>
      <text x="20" y="29" fill="#9dea38" font-family="Consolas, monospace" font-size="15" font-weight="700">03 / ПРОГРЕС</text>
      <text x="20" y="55" fill="#f4f6fa" font-family="Arial, sans-serif" font-size="20" font-weight="700">НАГОРОДИ Й РАНГИ</text>
    </g>
  </g>

  <text x="88" y="548" fill="#74839c" font-family="Consolas, monospace" font-size="14">ОФІЦІЙНА СТАТИСТИКА ЛАЗЕРТАГ-КЛУБУ</text>
  <text x="1112" y="548" fill="#f4f6fa" font-family="Consolas, monospace" font-size="16" font-weight="700" text-anchor="end">LASERTAGIF.ONLINE</text>
  <rect x="88" y="570" width="1024" height="4" fill="#17243a"/>
  <rect x="88" y="570" width="708" height="4" fill="#6fd3e8"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(outputPath);

console.log(outputPath);
