export let teams = {};

const teamsArea = document.getElementById('teams-area');

/**
 * @param {number} N - кількість команд
 * @param {Object} initialData - {1:[...],2:[...],…}
 */
export function initTeams(N, initialData) {
  teamsArea.innerHTML = '';
  teams = {};
  for (let k = 1; k <= N; k++) {
    teams[k] = (initialData[k] || []).slice();
    const sumPts = teams[k].reduce((s,p)=>s+p.pts,0);
    const box = document.createElement('div');
    box.className = 'card';
    box.innerHTML = `
      <label>
        <input type="checkbox" class="team-select" data-team="${k}">
        Команда ${k} (∑ ${sumPts})
      </label>
      <ul id="team${k}-list"></ul>
    `;
    teamsArea.append(box);
    const ul = box.querySelector('ul');
    teams[k].forEach((p,i)=>{
      const li = document.createElement('li');
      li.textContent = `${p.nick} (${p.pts})`;
      ul.append(li);
    });
  }
}
