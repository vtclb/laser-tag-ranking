import { RANK_THRESHOLDS } from '../core/rankRules.js';

const SCORE_RULES = [
  { label: 'Перемога', detail: 'базові очки за виграну гру', value: '+20', tone: 'plus' },
  { label: 'MVP 1 місце', detail: 'найсильніший особистий impact', value: '+12', tone: 'plus' },
  { label: 'MVP 2 місце', detail: 'другий внесок у гру', value: '+7', tone: 'plus' },
  { label: 'MVP 3 місце', detail: 'третій внесок у гру', value: '+3', tone: 'plus' }
];

const RANK_PENALTIES = {
  F: 0,
  E: -4,
  D: -6,
  C: -8,
  B: -10,
  A: -12,
  S: -14
};

const GENERAL_RULES = [
  'Рейтинг ведеться в межах активного сезону.',
  'Гравець отримує або втрачає очки за результатами ігор.',
  'MVP враховується тільки якщо гравець брав участь у цій грі.',
  'Результати гри має внести адміністратор або організатор.',
  'Якщо в даних є помилка, результат може бути виправлений.',
  'Активність у сезоні впливає на позицію в рейтингу.',
  'Архівні сезони можуть мати окрему статистику.'
];

const FAIR_PLAY_RULES = [
  'Повага до інших гравців обовʼязкова.',
  'Навмисний саботаж гри заборонений.',
  'Конфліктна або токсична поведінка може вплинути на зарахування результату.',
  'Результати потрібно повідомляти чесно.',
  'Гравці дотримуються правил клубу та інструкцій адміністратора.',
  'Адміністратор може не зарахувати гру або MVP при порушеннях.',
  'Спірні ситуації вирішує адміністратор або організатор.'
];

const FAQ_ITEMS = [
  {
    q: 'Як швидше підняти ранг?',
    a: 'Грати регулярно, перемагати і потрапляти в MVP. Найкраще працює стабільний результат, а не одна випадкова сильна гра.'
  },
  {
    q: 'Чому очки можуть рости повільніше на високому рангу?',
    a: 'На високих рангах діє більший штраф. Це утримує сезон конкурентним і не дає лідерам відриватись назавжди.'
  },
  {
    q: 'Що робити, якщо результат внесено неправильно?',
    a: 'Повідомити адміністратору. Якщо помилка підтвердиться, дані можна виправити.'
  },
  {
    q: 'Чи рахується MVP без участі в грі?',
    a: 'Ні. MVP має відповідати реальним учасникам конкретної гри.'
  }
];

function esc(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function rankRangeLabel(rank, min, nextMin) {
  if (rank === 'S') return `${min}+`;
  if (!Number.isFinite(nextMin)) return `${min}+`;
  return `${min}-${Math.max(min, nextMin - 1)}`;
}

function rankRows() {
  const ascending = [...RANK_THRESHOLDS].sort((a, b) => a[1] - b[1]);
  return ascending.map(([rank, min], index) => {
    const nextMin = ascending[index + 1]?.[1];
    const range = rankRangeLabel(rank, Number(min) || 0, Number(nextMin));
    const note = rank === 'F' ? 'перші ігри' : rank === 'S' ? 'максимальний рівень' : 'наступний крок';
    return `<div class="rules-v3-rank rules-v3-rank--${esc(rank.toLowerCase())}">
      <strong>${esc(rank)}</strong>
      <span>${esc(range)}</span>
      <em>${esc(note)}</em>
    </div>`;
  }).join('');
}

function scoringRows() {
  return SCORE_RULES.map((rule) => `<div class="rules-v3-score-row rules-v3-score-row--${esc(rule.tone)}">
    <span><b>${esc(rule.label)}</b><small>${esc(rule.detail)}</small></span>
    <strong>${esc(rule.value)}</strong>
  </div>`).join('');
}

function penaltyRows() {
  return ['F', 'E', 'D', 'C', 'B', 'A', 'S'].map((rank) => `<div class="rules-v3-penalty rules-v3-penalty--${rank.toLowerCase()}">
    <span>${esc(rank)}</span>
    <strong>${esc(RANK_PENALTIES[rank])}</strong>
  </div>`).join('');
}

function ruleRows(items = []) {
  return items.map((item, index) => `<div class="rules-v3-rule-row">
    <span>${index + 1}</span>
    <p>${esc(item)}</p>
  </div>`).join('');
}

function faqRows() {
  return FAQ_ITEMS.map((item) => `<article>
    <h3>${esc(item.q)}</h3>
    <p>${esc(item.a)}</p>
  </article>`).join('');
}

function renderRulesPage() {
  return `
    <section class="rules-v3-hero">
      <p class="rules-v3-kicker">Рейтингова система</p>
      <h1>Правила рейтингу</h1>
      <p>Як працює сезон, очки, ранги та правила гри.</p>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Коротко</h2>
        <p>Головна логіка сезону без деталей і повторів.</p>
      </div>
      <div class="rules-v3-summary">
        <article><span>Перемога</span><strong class="is-plus">+20</strong></article>
        <article><span>MVP</span><strong class="is-plus">+12 / +7 / +3</strong></article>
        <article><span>Ранги</span><strong>F → E → D → C → B → A → S</strong></article>
        <article><span>Штраф рангу</span><strong class="is-minus">залежить від сили гравця</strong></article>
      </div>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Як нараховуються очки</h2>
        <p>Бонуси за результат гри та особистий внесок MVP.</p>
      </div>
      <div class="rules-v3-score-list">${scoringRows()}</div>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Штрафи за ранг</h2>
        <p>Чим сильніший гравець, тим складніше набирати очки.</p>
      </div>
      <div class="rules-v3-penalties">${penaltyRows()}</div>
      <p class="rules-v3-note">Штраф рангу потрібен, щоб сильні гравці не відривались назавжди. Це робить сезон чеснішим і дає новим гравцям шанс наздоганяти.</p>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Ранги гравців</h2>
        <p>Прогресія від перших ігор до максимального рівня.</p>
      </div>
      <div class="rules-v3-rank-ladder">${rankRows()}</div>
    </section>

    <section class="rules-v3-section rules-v3-section--formula">
      <div class="rules-v3-section__head">
        <h2>Приклад розрахунку</h2>
        <p>Гравець B рангу переміг і отримав MVP2.</p>
      </div>
      <div class="rules-v3-formula">
        <div><span>Перемога</span><strong class="is-plus">+20</strong></div>
        <div><span>MVP2</span><strong class="is-plus">+7</strong></div>
        <div><span>B ранг</span><strong class="is-minus">-10</strong></div>
        <div class="rules-v3-formula__total"><span>Результат</span><strong class="is-plus">+17</strong></div>
      </div>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Загальні правила рейтингу</h2>
        <p>Як сезон і результати мають працювати в системі.</p>
      </div>
      <div class="rules-v3-rule-list">${ruleRows(GENERAL_RULES)}</div>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>Правила поведінки / Fair Play</h2>
        <p>Рейтинг має бути конкурентним, але чесним і комфортним.</p>
      </div>
      <div class="rules-v3-rule-list rules-v3-rule-list--fair">${ruleRows(FAIR_PLAY_RULES)}</div>
    </section>

    <section class="rules-v3-section">
      <div class="rules-v3-section__head">
        <h2>FAQ / уточнення</h2>
        <p>Нюанси, які не дублюють таблиці вище.</p>
      </div>
      <div class="rules-v3-faq">${faqRows()}</div>
    </section>
  `;
}

export async function initRulesPage() {
  const root = document.getElementById('rulesRoot') || document.getElementById('view');
  if (!root) return;
  root.classList.add('rules-v2', 'rules-v2--clean', 'rules-v3');
  root.innerHTML = renderRulesPage();
}
