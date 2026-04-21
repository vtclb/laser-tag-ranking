export async function initRulesPage() {
  const root = document.getElementById('rulesRoot') || document.getElementById('view');
  if (!root) return;
  root.classList.add('rules-v2', 'rules-v2--clean');
}
