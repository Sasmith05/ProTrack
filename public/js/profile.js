document.addEventListener('DOMContentLoaded', function () {
	// ── Avatar live preview ───────────────────────────────────
	const avatarInput = document.getElementById('avatarInput');
	const avatarPreview = document.getElementById('avatarPreview');

	if (avatarInput && avatarPreview) {
		avatarInput.addEventListener('change', function () {
			const file = this.files && this.files[0];
			if (!file) return;

			const MAX_MB = 2;
			if (file.size > MAX_MB * 1024 * 1024) {
				alert('File is too large. Maximum size is 2 MB.');
				avatarInput.value = '';
				return;
			}

			const reader = new FileReader();
			reader.onload = function (e) {
				// Replace whatever is inside the preview with an <img>
				avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Avatar preview" class="profile-avatar-img">`;
			};
			reader.readAsDataURL(file);
		});
	}

	// ── Sidebar toggle ────────────────────────────────────────
	const openBtn = document.getElementById('openSidebarBtn');
	const closeBtn = document.getElementById('closeSidebarBtn');
	const sidebar = document.getElementById('mySidenav');
	const overlay = document.getElementById('sidebarOverlay');

	function openNav() {
		if (!sidebar) return;
		sidebar.classList.add('open');
		sidebar.setAttribute('aria-hidden', 'false');
		if (overlay) { overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden', 'false'); }
	}

	function closeNav() {
		if (!sidebar) return;
		sidebar.classList.remove('open');
		sidebar.setAttribute('aria-hidden', 'true');
		if (overlay) { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }
	}

	if (openBtn) openBtn.addEventListener('click', openNav);
	if (closeBtn) closeBtn.addEventListener('click', closeNav);
	if (overlay) overlay.addEventListener('click', closeNav);

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeNav();
	});
});
