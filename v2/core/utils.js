export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seasonId: params.get('season') || undefined,
    league: params.get('league') || undefined,
    nick: params.get('nick') || undefined
  };
}

export function formatRatio(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export function statOrDash(value) {
  return value === 0 ? '—' : value ?? '—';
}

export function createTop3Markup(items) {
  return items
    .slice(0, 3)
    .map((player, index) => `
      <article class="top-card rank-${index + 1}">
        <span class="rank-badge">#${index + 1}</span>
        <h3>${player.nick}</h3>
        <p>${player.points} pts</p>
      </article>
    `)
    .join('');
}
