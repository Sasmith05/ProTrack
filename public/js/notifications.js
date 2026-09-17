/* notifications.js — Notification bell polling and dropdown */

(function () {
  const notifBtn      = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifBadge    = document.getElementById('notifBadge');
  const notifList     = document.getElementById('notifList');
  const notifMarkAll  = document.getElementById('notifMarkAll');

  if (!notifBtn) return; // Not logged in

  let notifications = [];
  let open = false;

  function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderNotifications() {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length > 0) {
      notifBadge.textContent = unread.length > 9 ? '9+' : unread.length;
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
    }

    if (!notifications.length) {
      notifList.innerHTML = '<li class="notif-empty">No notifications</li>';
      return;
    }

    notifList.innerHTML = notifications.slice(0, 15).map(n => `
      <li class="notif-item ${!n.is_read ? 'unread' : ''}" data-id="${n.id}" data-read="${n.is_read}">
        <span class="notif-type-dot ${escHtml(n.type)}"></span>
        <div class="notif-item-body">
          <p class="notif-item-title">${escHtml(n.title)}</p>
          <p class="notif-item-msg">${escHtml(n.message)}</p>
          <p class="notif-item-time">${timeAgo(n.created_at)}</p>
        </div>
      </li>
    `).join('');
  }

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      notifications = data.notifications || [];
      renderNotifications();
    } catch (_e) { /* silent */ }
  }

  async function markRead(id) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: { Accept: 'application/json' } });
      const n = notifications.find(x => x.id === id);
      if (n) n.is_read = 1;
      renderNotifications();
    } catch (_e) { /* silent */ }
  }

  async function markAllRead() {
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Accept: 'application/json' } });
      notifications.forEach(n => { n.is_read = 1; });
      renderNotifications();
    } catch (_e) { /* silent */ }
  }

  function toggleDropdown() {
    open = !open;
    notifDropdown.classList.toggle('hidden', !open);
  }

  function closeDropdown() {
    open = false;
    notifDropdown.classList.add('hidden');
  }

  notifBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(); });
  if (notifMarkAll) notifMarkAll.addEventListener('click', (e) => { e.stopPropagation(); markAllRead(); });

  notifList.addEventListener('click', (e) => {
    const item = e.target.closest('.notif-item');
    if (item && !Number(item.dataset.read)) markRead(Number(item.dataset.id));
  });

  document.addEventListener('click', (e) => {
    if (open && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // Initial fetch + poll every 30 seconds
  fetchNotifications();
  setInterval(fetchNotifications, 30000);
})();
