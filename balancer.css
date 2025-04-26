// scripts/teams.js
export let teams = {};   // тепер глобально експортуємо обʼєкт

const teamsArea = document.getElementById('teams-area');

/**
 * Ініціалізує команди
 * @param {number} N - кількість команд
 * @param {Object} initialData - {1: [...], 2: [...], ...}
 */
export function initTeams(N, initialData) {
  teamsArea.classList.remove('hidden');
  teams = {};
  for (let k = 1; k <= N; k++) {
    // або візьмемо з initialData, або порожній масив
    teams[k] = (initialData[k] || []).slice();
  }
  renderTeams(N);
}

function renderTeams(N) {
  teamsArea.innerHTML = ''; 
  teamsArea.style.gridTemplateColumns = `repeat(${N},1fr)`;
  
  for (let k = 1; k <= N; k++) {
    const box = document.createElement('div');
    box.className = 'card';
    box.innerHTML = `<h3>Команда ${k} (∑ ${sum(teams[k])})</h3><ul id="team${k}-list"></ul>`;
    teamsArea.append(box);
    const ul = box.querySelector('ul');
    teams[k].forEach((p, idx) => appendPlayer(ul, p, k, idx));
  }
}

function appendPlayer(ul, p, teamId, idx) {
  const li = document.createElement('li');
  li.innerHTML = `
    ${p.nick} (${p.pts})
    <button class="remove-team" data-team="${teamId}" data-index="${idx}">✕</button>
    <button class="swap-team" data-from="${teamId}" data-index="${idx}">↔️</button>
  `;
  ul.append(li);
}

function sum(arr) {
  return arr.reduce((s, x) => s + x.pts, 0);
}

// Оброблюємо кліки по кнопках усередині teamsArea
teamsArea.addEventListener('click', e => {
  // Вилучення з команди
  if (e.target.matches('.remove-team')) {
    const teamId = +e.target.dataset.team;
    const idx    = +e.target.dataset.index;
    const p      = teams[teamId].splice(idx, 1)[0];
    // Повертаємо гравця у лоббі
    import('./lobby.js').then(mod => {
      mod.lobby.push(p);
      mod.renderLobby();
    });
    renderTeams(Object.keys(teams).length);
  }
  // Свап команди: просто тягнемо в іншу групу (наприклад, назад у лоббі в manual режимі)
  if (e.target.matches('.swap-team')) {
    const from = +e.target.dataset.from;
    const idx  = +e.target.dataset.index;
    const p    = teams[from].splice(idx,1)[0];
    // У коді swap-team ви можете додати діалог в який teamId перемістити
    // Або просто повернути в лоббі:
    import('./lobby.js').then(mod => {
      mod.lobby.push(p);
      mod.renderLobby();
    });
    renderTeams(Object.keys(teams).length);
  }
});
