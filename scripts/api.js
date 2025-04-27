const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';

export async function loadPlayers(league) {
  const res = await fetch(`${proxyUrl}?league=${league}&t=${Date.now()}`);
  const txt = await res.text();
  return txt
    .trim()
    .split('\n').slice(1)
    .filter(l=>l)
    .map(line => {
      const cols = line.split(',');
      const nick = cols[1]?.trim();
      const pts  = parseInt(cols[2],10)||0;
      const rank = pts<200?'D'
                 : pts<500?'C'
                 : pts<800?'B'
                 : pts<1200?'A':'S';
      return { nick, pts, rank };
    });
}

export async function saveResult(data) {
  const body = new URLSearchParams(data);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  return res.text();
}
