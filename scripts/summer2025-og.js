#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.resolve(PROJECT_ROOT, 'assets', 'summer2025-table-preview.png');
const DATA_FILE = path.resolve(PROJECT_ROOT, 'SL_Summer2025_pack.json');

function parseArgs(argv) {
  const args = { out: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--out' || token === '-o') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('Expected a path after --out');
      }
      args.out = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }
    if (token.startsWith('--out=')) {
      const outPath = token.slice('--out='.length);
      if (!outPath) {
        throw new Error('Expected a path after --out=');
      }
      args.out = path.resolve(process.cwd(), outPath);
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const numberFormatter = new Intl.NumberFormat('uk-UA');
const percentFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 1
});

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numberFormatter.format(numeric);
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return percentFormatter.format(numeric);
}

function buildRows(players) {
  const rowHeight = 74;
  const startY = 280;
  return players
    .map((player, index) => {
      const y = startY + index * rowHeight;
      const rank = formatNumber(player.rank);
      const name = escapeXml(player.player ?? 'Невідомо');
      const points = formatNumber(player.season_points);
      const games = formatNumber(player.games);
      const winRate = formatPercent(player.winRate);
      const mvps = formatNumber(player.MVP);
      const badge = escapeXml(player.rankTier ?? '—');

      return `
        <g transform="translate(90 ${y})">
          <rect x="0" y="-52" width="1020" height="62" rx="14" fill="rgba(10, 16, 34, 0.72)" stroke="rgba(255, 255, 255, 0.08)" />
          <text x="30" y="-15" fill="#FFD700" font-size="36" font-weight="700" font-family="'Inter', 'DejaVu Sans', sans-serif">${rank}</text>
          <text x="110" y="-15" fill="#F8F8FF" font-size="32" font-weight="600" font-family="'Inter', 'DejaVu Sans', sans-serif">${name}</text>
          <text x="525" y="-15" fill="#FFD700" font-size="32" font-weight="600" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${points}</text>
          <text x="680" y="-15" fill="#9DD7FF" font-size="28" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${games}</text>
          <text x="830" y="-15" fill="#9DD7FF" font-size="28" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${winRate}</text>
          <text x="960" y="-15" fill="#FF66C4" font-size="28" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${mvps}</text>
          <g transform="translate(1010 -41)">
            <rect x="0" y="0" width="60" height="32" rx="9" fill="#FF66C4" />
            <text x="30" y="23" fill="#05070E" font-size="20" text-anchor="middle" font-weight="700" font-family="'Inter', 'DejaVu Sans', sans-serif">${badge}</text>
          </g>
        </g>`;
    })
    .join('');
}

function buildStats(pack) {
  const aggregates = pack.aggregates ?? {};
  const topPlayers = (pack.top10 ?? []).slice(0, 3);
  const statBlocks = [
    { label: 'Ігор сезону', value: formatNumber(aggregates.total_games) },
    { label: 'Учасників', value: formatNumber(aggregates.players_in_rating ?? aggregates.players_with_games) },
    { label: 'Раундів', value: formatNumber(aggregates.total_rounds) },
    {
      label: 'Очки топ-3',
      value: formatNumber(
        topPlayers.reduce((sum, player) => sum + (Number(player.season_points) || 0), 0)
      )
    }
  ];

  return statBlocks
    .map((stat, index) => {
      const x = 150 + index * 260;
      return `
        <g transform="translate(${x} 220)">
          <rect x="0" y="-90" width="220" height="88" rx="18" fill="rgba(12, 24, 52, 0.78)" stroke="rgba(255, 255, 255, 0.06)" />
          <text x="110" y="-52" fill="#9DD7FF" font-size="20" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${escapeXml(stat.label)}</text>
          <text x="110" y="-16" fill="#FFD700" font-size="34" font-weight="700" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${stat.value}</text>
        </g>`;
    })
    .join('');
}

function buildPodium(pack) {
  const podium = pack.aggregates?.podium ?? {};
  const entries = [
    { color: '#FFD700', label: '1', name: podium.gold },
    { color: '#C0C0C0', label: '2', name: podium.silver },
    { color: '#CD7F32', label: '3', name: podium.bronze }
  ];

  return entries
    .map((entry, index) => {
      const x = 160 + index * 320;
      return `
        <g transform="translate(${x} 500)">
          <rect x="0" y="-140" width="280" height="120" rx="24" fill="rgba(255, 255, 255, 0.05)" stroke="${entry.color}" stroke-width="3" />
          <text x="40" y="-82" fill="${entry.color}" font-size="52" font-weight="700" font-family="'Inter', 'DejaVu Sans', sans-serif">${escapeXml(entry.label)}</text>
          <text x="140" y="-82" fill="#F8F8FF" font-size="32" font-weight="600" font-family="'Inter', 'DejaVu Sans', sans-serif">${escapeXml(entry.name ?? '—')}</text>
          <text x="140" y="-36" fill="#9DD7FF" font-size="22" font-family="'Inter', 'DejaVu Sans', sans-serif">П'єдестал</text>
        </g>`;
    })
    .join('');
}

function createSvg(pack) {
  const width = 1200;
  const height = 630;
  const meta = pack.meta ?? {};
  const title = escapeXml(meta.season ?? 'Літній сезон 2025');
  const subtitle = escapeXml(meta.league ?? 'Sunday League');

  const topRows = buildRows((pack.top10 ?? []).slice(0, 5));
  const stats = buildStats(pack);
  const podium = buildPodium(pack);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05070E" />
      <stop offset="50%" stop-color="#12092B" />
      <stop offset="100%" stop-color="#250C3F" />
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.1" r="0.9">
      <stop offset="0%" stop-color="rgba(255, 102, 196, 0.4)" />
      <stop offset="100%" stop-color="rgba(255, 102, 196, 0)" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg-gradient)" />
  <rect x="40" y="40" width="1120" height="550" rx="38" fill="rgba(9, 12, 28, 0.88)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="2" />
  <rect x="40" y="40" width="1120" height="550" rx="38" fill="url(#glow)" />
  <text x="600" y="140" fill="#FFD700" font-size="64" font-weight="700" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${title}</text>
  <text x="600" y="190" fill="#9DD7FF" font-size="30" font-weight="500" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">${subtitle}</text>
  <text x="110" y="248" fill="#9DD7FF" font-size="24" font-weight="500" font-family="'Inter', 'DejaVu Sans', sans-serif">Ранг</text>
  <text x="200" y="248" fill="#9DD7FF" font-size="24" font-weight="500" font-family="'Inter', 'DejaVu Sans', sans-serif">Гравець</text>
  <text x="525" y="248" fill="#9DD7FF" font-size="24" font-weight="500" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">Очки</text>
  <text x="680" y="248" fill="#9DD7FF" font-size="24" font-weight="500" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">Ігор</text>
  <text x="830" y="248" fill="#9DD7FF" font-size="24" font-weight="500" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">Win%</text>
  <text x="960" y="248" fill="#9DD7FF" font-size="24" font-weight="500" text-anchor="middle" font-family="'Inter', 'DejaVu Sans', sans-serif">MVP</text>
  ${stats}
  ${topRows}
  ${podium}
</svg>`;
}

async function generateOgImage(outPath) {
  const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
  const pack = JSON.parse(raw);
  const svg = createSvg(pack);
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const buffer = Buffer.from(svg, 'utf8');
  await sharp(buffer, { density: 240 }).png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    console.error('\nUsage: node scripts/summer2025-og.js [--out path/to/output.png]');
    return;
  }

  if (args.help) {
    console.log('Generate the Summer 2025 social preview PNG.');
    console.log('Usage: node scripts/summer2025-og.js [--out path/to/output.png]');
    return;
  }

  const outPath = args.out ?? DEFAULT_OUTPUT;
  try {
    await generateOgImage(outPath);
    const relative = path.relative(process.cwd(), outPath);
    console.log(`Social preview generated at ${relative}`);
  } catch (error) {
    console.error('Failed to generate preview:');
    console.error(error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  createSvg
};
