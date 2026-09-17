/* toast.js — Global toast notification system */

(function () {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    return container;
  }

  const ICONS = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const TITLES = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };

  /**
   * showToast(message, type = 'info', duration = 4000)
   * type: 'success' | 'error' | 'warning' | 'info'
   */
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || 'ℹ'}</span>
      <div class="toast-body">
        <p class="toast-title">${TITLES[type] || 'Notice'}</p>
        <p class="toast-message">${escapeHtml(message)}</p>
      </div>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));
    getContainer().appendChild(toast);

    const timer = setTimeout(() => dismiss(toast), duration);
    toast._timer = timer;
  }

  function dismiss(toast) {
    if (!toast || toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.showToast = showToast;
})();
