/* search.js — Global search with debounce */

(function () {
  const input    = document.getElementById('globalSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  if (!input || !dropdown) return;

  let debounceTimer = null;

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
  }

  function buildSection(label, items, renderFn) {
    if (!items || !items.length) return '';
    return `
      <div class="search-group-label">${label}</div>
      ${items.map(renderFn).join('')}
    `;
  }

  async function doSearch(q) {
    if (!q || q.length < 2) { closeDropdown(); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (!res.ok) return;

      const { users = [], projects = [], tasks = [] } = data.results || {};

      if (!users.length && !projects.length && !tasks.length) {
        dropdown.innerHTML = '<div class="search-empty">No results found for "' + escHtml(q) + '"</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      let html = '';

      html += buildSection('Users', users, u => `
        <a href="/users-page" class="search-result-item">
          <div class="search-result-icon" style="background:rgba(79,116,255,0.15);color:#4f74ff;">👤</div>
          <div class="search-result-info">
            <div class="search-result-name">${escHtml(u.first_name)} ${escHtml(u.last_name)}</div>
            <div class="search-result-sub">${escHtml(u.email)} · ${escHtml(u.role)}</div>
          </div>
        </a>
      `);

      if (users.length && projects.length) html += '<div class="search-divider"></div>';

      html += buildSection('Projects', projects, p => `
        <a href="/projects-page" class="search-result-item">
          <div class="search-result-icon" style="background:rgba(168,85,247,0.15);color:#a855f7;">📁</div>
          <div class="search-result-info">
            <div class="search-result-name">${escHtml(p.project_name)}</div>
            <div class="search-result-sub">Status: ${escHtml(p.status)}</div>
          </div>
        </a>
      `);

      if ((users.length || projects.length) && tasks.length) html += '<div class="search-divider"></div>';

      html += buildSection('Tasks', tasks, t => `
        <a href="/tasks-page" class="search-result-item">
          <div class="search-result-icon" style="background:rgba(34,197,94,0.15);color:#22c55e;">✓</div>
          <div class="search-result-info">
            <div class="search-result-name">${escHtml(t.title)}</div>
            <div class="search-result-sub">${escHtml(t.project_name || '')} · ${escHtml(t.priority)} · ${escHtml(t.status)}</div>
          </div>
        </a>
      `);

      dropdown.innerHTML = html;
      dropdown.classList.remove('hidden');
    } catch (_e) {
      closeDropdown();
    }
  }

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const q = e.target.value.trim();
    if (!q) { closeDropdown(); return; }
    debounceTimer = setTimeout(() => doSearch(q), 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDropdown(); input.blur(); }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
  });
})();
