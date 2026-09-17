/* calendar.js — Monthly task calendar */

const SESSION_ROLE = window.__SESSION_ROLE || '';

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-indexed
let tasksByDate  = {}; // key = 'YYYY-MM-DD'

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(s) {
	return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const MONTHS = ['January','February','March','April','May','June',
	'July','August','September','October','November','December'];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const sidebar = document.getElementById('mySidenav');
const sidebarOverlay = document.getElementById('sidebarOverlay');
document.getElementById('openSidebarBtn').addEventListener('click', () => {
	sidebar.classList.add('open'); sidebarOverlay.classList.remove('hidden');
});
document.getElementById('closeSidebarBtn').addEventListener('click', () => {
	sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden');
});
if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => {
	sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden');
});

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchTasks(year, month) {
	const res = await fetch(`/tasks/calendar?year=${year}&month=${month}`, { headers: { Accept: 'application/json' } });
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Failed to load tasks');
	return data.tasks || [];
}

// ─── Build calendar ───────────────────────────────────────────────────────────

function buildTasksByDate(tasks) {
	tasksByDate = {};
	tasks.forEach(t => {
		if (!t.due_date) return;
		const key = String(t.due_date).slice(0, 10);
		if (!tasksByDate[key]) tasksByDate[key] = [];
		tasksByDate[key].push(t);
	});
}

function renderCalendar(year, month) {
	const grid = document.getElementById('calGrid');
	const titleEl = document.getElementById('calMonthTitle');
	grid.innerHTML = '';
	titleEl.textContent = `${MONTHS[month - 1]} ${year}`;

	const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
	const daysInMonth = new Date(year, month, 0).getDate();
	const today = new Date().toISOString().slice(0, 10);

	// Prev month padding
	const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
	for (let i = firstDay - 1; i >= 0; i--) {
		const cell = document.createElement('div');
		cell.className = 'cal-day cal-day--other-month';
		cell.innerHTML = `<span class="cal-day-number">${daysInPrevMonth - i}</span>`;
		grid.appendChild(cell);
	}

	// Current month days
	for (let d = 1; d <= daysInMonth; d++) {
		const pad = String(d).padStart(2, '0');
		const padM = String(month).padStart(2, '0');
		const dateKey = `${year}-${padM}-${pad}`;
		const isToday = dateKey === today;

		const cell = document.createElement('div');
		cell.className = `cal-day${isToday ? ' cal-day--today' : ''}`;
		cell.dataset.date = dateKey;

		const dayTasks = tasksByDate[dateKey] || [];
		const visibleTasks = dayTasks.slice(0, 3);
		const extra = dayTasks.length - visibleTasks.length;

		cell.innerHTML = `
			<span class="cal-day-number">${d}</span>
			<div class="cal-day-tasks">
				${visibleTasks.map(t => {
					const chipClass = t.status === 'completed' ? 'status-completed' : `priority-${t.priority}`;
					return `<span class="cal-task-chip ${chipClass}" data-id="${t.id}" title="${escHtml(t.title)}">${escHtml(t.title)}</span>`;
				}).join('')}
				${extra > 0 ? `<span class="cal-more">+${extra} more</span>` : ''}
			</div>
		`;

		if (dayTasks.length > 0) {
			cell.addEventListener('click', () => openDayPanel(dateKey, dayTasks));
		}
		grid.appendChild(cell);
	}

	// Next month padding to fill 7 columns
	const totalCells = firstDay + daysInMonth;
	const remainder = totalCells % 7;
	if (remainder !== 0) {
		for (let d = 1; d <= 7 - remainder; d++) {
			const cell = document.createElement('div');
			cell.className = 'cal-day cal-day--other-month';
			cell.innerHTML = `<span class="cal-day-number">${d}</span>`;
			grid.appendChild(cell);
		}
	}
}

async function loadAndRenderCalendar(year, month) {
	try {
		const tasks = await fetchTasks(year, month);
		buildTasksByDate(tasks);
		renderCalendar(year, month);
	} catch (err) {
		document.getElementById('calGrid').innerHTML = `<div style="padding:20px;color:#ef4444;grid-column:1/-1;">${escHtml(err.message)}</div>`;
	}
}

// ─── Navigation ───────────────────────────────────────────────────────────────

document.getElementById('calPrevBtn').addEventListener('click', () => {
	currentMonth--;
	if (currentMonth < 1) { currentMonth = 12; currentYear--; }
	loadAndRenderCalendar(currentYear, currentMonth);
});

document.getElementById('calNextBtn').addEventListener('click', () => {
	currentMonth++;
	if (currentMonth > 12) { currentMonth = 1; currentYear++; }
	loadAndRenderCalendar(currentYear, currentMonth);
});

document.getElementById('calTodayBtn').addEventListener('click', () => {
	const now = new Date();
	currentYear  = now.getFullYear();
	currentMonth = now.getMonth() + 1;
	loadAndRenderCalendar(currentYear, currentMonth);
});

// ─── Day Panel ────────────────────────────────────────────────────────────────

const dayPanel   = document.getElementById('dayPanel');
const dayPanelOverlay = document.getElementById('dayPanelOverlay');
const dayPanelTitle = document.getElementById('dayPanelTitle');
const dayPanelBody  = document.getElementById('dayPanelBody');

function openDayPanel(dateKey, tasks) {
	dayPanelTitle.textContent = `Tasks due ${dateKey}`;
	dayPanelBody.innerHTML = tasks.map(t => {
		const priorityColors = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
		const col = priorityColors[t.priority] || '#94a3b8';
		return `<div class="day-panel-task" onclick="window.location='/tasks-page'">
			<div style="width:4px;background:${col};border-radius:4px;flex-shrink:0;min-height:36px;"></div>
			<div>
				<p class="day-panel-task-title">${escHtml(t.title)}</p>
				<p class="day-panel-task-sub">${escHtml(t.project_name || '')} · ${escHtml(t.priority)} · ${escHtml(t.status)}</p>
				${t.assigned_name ? `<p class="day-panel-task-sub">👤 ${escHtml(t.assigned_name)}</p>` : ''}
			</div>
		</div>`;
	}).join('');
	dayPanel.classList.remove('hidden');
	dayPanelOverlay.classList.remove('hidden');
}

document.getElementById('closeDayPanel').addEventListener('click', () => {
	dayPanel.classList.add('hidden');
	dayPanelOverlay.classList.add('hidden');
});

if (dayPanelOverlay) dayPanelOverlay.addEventListener('click', () => {
	dayPanel.classList.add('hidden');
	dayPanelOverlay.classList.add('hidden');
});

document.addEventListener('keydown', e => {
	if (e.key === 'Escape') {
		dayPanel.classList.add('hidden');
		dayPanelOverlay.classList.add('hidden');
		sidebar.classList.remove('open');
		sidebarOverlay.classList.add('hidden');
	}
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadAndRenderCalendar(currentYear, currentMonth);
