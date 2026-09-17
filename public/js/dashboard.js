document.addEventListener('DOMContentLoaded', function () {
	const stats = window.__STATS__;
	if (!stats) return;

	// ── User Status Doughnut ──────────────────────────────────
	const userCtx = document.getElementById('userStatusChart');
	if (userCtx) {
		new Chart(userCtx, {
			type: 'doughnut',
			data: {
				labels: ['Active', 'Inactive'],
				datasets: [{
					data: [stats.users.active, stats.users.inactive],
					backgroundColor: ['#22c55e', '#94a3b8'],
					borderColor: ['#16a34a', '#64748b'],
					borderWidth: 2,
					hoverOffset: 6
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#94a3b8', font: { size: 13 }, padding: 16 }
					},
					tooltip: {
						callbacks: {
							label: function (ctx) {
								const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
								const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
								return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
							}
						}
					}
				},
				cutout: '65%'
			}
		});
	}

	// ── Project Status Doughnut ───────────────────────────────
	const projectCtx = document.getElementById('projectStatusChart');
	if (projectCtx) {
		new Chart(projectCtx, {
			type: 'doughnut',
			data: {
				labels: ['Ongoing', 'Completed', 'On Hold'],
				datasets: [{
					data: [stats.projects.ongoing, stats.projects.completed, stats.projects.on_hold],
					backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
					borderColor: ['#2563eb', '#16a34a', '#d97706'],
					borderWidth: 2,
					hoverOffset: 6
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#94a3b8', font: { size: 13 }, padding: 16 }
					},
					tooltip: {
						callbacks: {
							label: function (ctx) {
								const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
								const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
								return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
							}
						}
					}
				},
				cutout: '65%'
			}
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
