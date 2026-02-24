function wrapSectionContent(section) {
  const directCards = section.querySelector(':scope > .px-card');
  if (directCards) return;
  const card = document.createElement('div');
  card.className = 'px-card';
  while (section.firstChild) {
    card.appendChild(section.firstChild);
  }
  section.appendChild(card);
}

function addDividers(main) {
  const items = Array.from(main.querySelectorAll(':scope > .container > section'));
  items.forEach((item, index) => {
    if (index === items.length - 1) return;
    const divider = document.createElement('div');
    divider.className = 'px-divider';
    item.insertAdjacentElement('afterend', divider);
  });
}

function setupSkeleton() {
  const tables = document.querySelectorAll('table tbody');
  tables.forEach((tbody) => {
    if (tbody.children.length) return;
    const host = tbody.closest('.px-card, .table-container, section, .container');
    if (!host) return;
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    skeleton.innerHTML = '<div class="skeleton__line"></div>'.repeat(5);
    host.prepend(skeleton);

    const observer = new MutationObserver(() => {
      if (tbody.children.length > 0) {
        skeleton.remove();
        observer.disconnect();
      }
    });
    observer.observe(tbody, { childList: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (!main) return;
  main.querySelectorAll('section').forEach(wrapSectionContent);
  main.querySelectorAll('.pagination button').forEach((btn) => btn.classList.add('btn', 'btn--secondary'));
  addDividers(main);
  setupSkeleton();
});
