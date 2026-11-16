const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function tournamentDay(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/.exec(text);
  if (!match) return '';
  const [, year, month, day] = match;
  const check = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (!Number.isFinite(check.valueOf()) || check.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return '';
  if (text.length === 10) return text;
  const dated = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (!dated) return Number.isFinite(Date.parse(text)) ? `${year}-${month}-${day}` : '';
  const instant = new Date(text);
  return Number.isFinite(instant.valueOf()) ? dayFormatter.format(instant) : '';
}

export function tournamentStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['active', 'активний'].includes(status)) return 'active';
  if (['finished', 'completed', 'завершений'].includes(status)) return 'finished';
  if (['cancelled', 'canceled', 'скасований'].includes(status)) return 'cancelled';
  if (['scheduled', 'planned', 'планується', 'запланований'].includes(status)) return 'planned';
  return 'unknown';
}

// Calendar position is presentation only; never rewrite the source status or results.
export function tournamentPresentation(item, now = new Date()) {
  const start = tournamentDay(item.dateStart), end = tournamentDay(item.dateEnd);
  const today = dayFormatter.format(now), raw = tournamentStatus(item.status);
  if (raw === 'cancelled') return { group: 'past', label: 'Скасований', day: end || start };
  if (tournamentStatus(item.displayStatus || item.status) === 'finished') return { group: 'past', label: 'Завершений', day: end || start };
  if (!start || (item.dateEnd && (!end || end < start))) return { group: 'undated', label: 'Дата потребує уточнення', day: start };
  if ((end || start) < today) return { group: 'past', label: 'Минула подія · статус не уточнено', day: end || start };
  if (!['active', 'planned'].includes(raw)) return { group: 'undated', label: 'Статус потребує уточнення', day: start };
  if (start > today) return { group: 'upcoming', label: 'Запланований', day: start };
  if (raw === 'active') return { group: 'current', label: 'Поточний', day: start };
  return { group: 'undated', label: 'Статус потребує уточнення', day: start };
}

export const tournamentGroupLabels = {
  current: 'Поточні турніри', upcoming: 'Найближчі турніри', past: 'Архів турнірів', undated: 'Потребують уточнення'
};

export function sortTournaments(items, now = new Date()) {
  const priorities = { current: 0, upcoming: 1, past: 2, undated: 3 };
  return [...items].sort((a, b) => {
    const x = tournamentPresentation(a, now), y = tournamentPresentation(b, now);
    return priorities[x.group] - priorities[y.group]
      || (x.group === 'past' ? y.day.localeCompare(x.day) : x.day.localeCompare(y.day))
      || String(a.tournamentId).localeCompare(String(b.tournamentId));
  });
}

export function featuredTournaments(items, now = new Date()) {
  const sorted = sortTournaments(items, now);
  const scheduled = sorted.filter(item => ['current', 'upcoming'].includes(tournamentPresentation(item, now).group));
  return (scheduled.length ? scheduled : sorted.filter(item => tournamentPresentation(item, now).group === 'past')).slice(0, 2);
}
