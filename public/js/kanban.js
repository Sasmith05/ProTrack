/* kanban.js — Drag-and-drop Kanban board */

const CAN_MANAGE = window.__CAN_MANAGE_TASKS === true;
const SESSION_ROLE = window.__SESSION_ROLE || '';
const SESSION_USER_ID = window.__SESSION_USER_ID || 0;

let allProjects = [];
let allUsers = [];
let boardFilters = {};
let draggedCard = null;
let draggedTaskId = null;

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(s) {
	return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(v) {
	if (!v) return null;
	const d = new Date(v);
	return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function timeAgo(v) {
	if (!v) return '';
	const diff = (Date.now() - new Date(v).getTime()) / 1000;
	if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
	if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
	return Math.floor(diff / 86400) + 'd ago';
}

function initials(name) {
	return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

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

async function apiFetch(url, opts) {
	const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, ...opts });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Request failed');
	return data;
}

// ─── Reference data ───────────────────────────────────────────────────────────

async function loadReferenceData() {
	const [projRes, userRes] = await Promise.allSettled([
		fetch('/projects', { headers: { Accept: 'application/json' } }).then(r => r.json()),
		fetch('/users', { headers: { Accept: 'application/json' } }).then(r => r.json())
	]);
	allProjects = projRes.status === 'fulfilled' ? projRes.value.projects || [] : [];
	allUsers    = userRes.status === 'fulfilled' ? userRes.value.users || [] : [];

	const projSel = document.getElementById('kanbanProjectFilter');
	const userSel = document.getElementById('kanbanAssigneeFilter');
	if (projSel) allProjects.forEach(p => projSel.insertAdjacentHTML('beforeend', `<option value="${p.id}">${escHtml(p.project_name)}</option>`));
	if (userSel) allUsers.forEach(u => userSel.insertAdjacentHTML('beforeend', `<option value="${u.id}">${escHtml(u.first_name + ' ' + u.last_name)}</option>`));
}

// ─── Build board ──────────────────────────────────────────────────────────────

function buildCard(task) {
	const due       = formatDate(task.due_date);
	const isOverdue = due && new Date(due) < new Date() && task.status !== 'completed';
	const progress  = task.estimated_hours && task.actual_hours
		? Math.min(100, Math.round((task.actual_hours / task.estimated_hours) * 100))
		: (task.status === 'completed' ? 100 : 0);

	const card = document.createElement('div');
	card.className = 'kanban-card';
	card.draggable = true;
	card.dataset.id = task.id;
	card.dataset.priority = task.priority;
	card.dataset.status = task.status;

	card.innerHTML = `
		<p class="card-title">${escHtml(task.title)}</p>
		<p class="card-project">${escHtml(task.project_name || '')}</p>
		<div class="card-meta">
			${task.assigned_name ? `
			<div class="card-assignee">
				<div class="assignee-avatar">${initials(task.assigned_name)}</div>
				<span>${escHtml(task.assigned_name.split(' ')[0])}</span>
			</div>` : '<span style="font-size:11px;color:var(--muted)">Unassigned</span>'}
			${due ? `<span class="card-due${isOverdue ? ' overdue' : ''}">${due}</span>` : ''}
		</div>
		${task.estimated_hours ? `
		<div class="card-footer">
			<div class="card-progress">
				<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
				<span class="progress-text">${progress}%</span>
			</div>
			<button class="card-detail-btn" data-id="${task.id}">Details</button>
		</div>` : `
		<div class="card-footer" style="justify-content:flex-end">
			<button class="card-detail-btn" data-id="${task.id}">Details</button>
		</div>`}
	`;

	// Drag events
	card.addEventListener('dragstart', (e) => {
		draggedCard   = card;
		draggedTaskId = task.id;
		card.classList.add('dragging');
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', String(task.id));
	});
	card.addEventListener('dragend', () => {
		card.classList.remove('dragging');
		draggedCard = null;
	});

	// Touch (mobile) - click card detail btn
	card.querySelector('.card-detail-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		openTaskDetail(Number(card.dataset.id));
	});

	return card;
}

async function renderBoard(tasks) {
	const cols = {
		todo: document.getElementById('col-todo'),
		in_progress: document.getElementById('col-in_progress'),
		review: document.getElementById('col-review'),
		completed: document.getElementById('col-completed')
	};

	Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });
	const counts = { todo: 0, in_progress: 0, review: 0, completed: 0 };

	tasks.forEach(task => {
		const col = cols[task.status];
		if (col) {
			col.appendChild(buildCard(task));
			if (counts[task.status] !== undefined) counts[task.status]++;
		}
	});

	// Empty states
	Object.entries(cols).forEach(([status, col]) => {
		if (!col) return;
		if (!counts[status]) {
			col.innerHTML = '<div class="kanban-empty">No tasks here</div>';
		}
		const countEl = document.getElementById(`colCount-${status}`);
		if (countEl) countEl.textContent = counts[status];
	});

	setupDropZones();
}

async function loadBoard() {
	const params = new URLSearchParams({ limit: 200 });
	if (boardFilters.project_id) params.set('project_id', boardFilters.project_id);
	if (boardFilters.assigned_to) params.set('assigned_to', boardFilters.assigned_to);
	if (boardFilters.priority)    params.set('priority', boardFilters.priority);

	const msgEl = document.getElementById('kanbanMessage');
	if (msgEl) msgEl.textContent = '';

	try {
		const data = await apiFetch('/tasks?' + params.toString());
		await renderBoard(data.tasks || []);
	} catch (err) {
		if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = '#ef4444'; }
	}
}

// ─── Drag and Drop ────────────────────────────────────────────────────────────

function setupDropZones() {
	document.querySelectorAll('.kanban-cards').forEach(col => {
		col.addEventListener('dragover', e => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			col.closest('.kanban-col').classList.add('drag-over');
		});
		col.addEventListener('dragleave', e => {
			if (!col.contains(e.relatedTarget)) {
				col.closest('.kanban-col').classList.remove('drag-over');
			}
		});
		col.addEventListener('drop', async e => {
			e.preventDefault();
			col.closest('.kanban-col').classList.remove('drag-over');
			const newStatus = col.dataset.status;
			const taskId    = draggedTaskId;
			if (!taskId || !newStatus) return;

			// Optimistic UI
			if (draggedCard) col.appendChild(draggedCard);
			try {
				await apiFetch(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
				showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'success');
				// Reload to refresh counts
				loadBoard();
			} catch (err) {
				showToast(err.message, 'error');
				loadBoard(); // rollback by reload
			}
		});
	});
}

// ─── Filters ──────────────────────────────────────────────────────────────────

['kanbanProjectFilter', 'kanbanAssigneeFilter', 'kanbanPriorityFilter'].forEach(id => {
	const el = document.getElementById(id);
	if (el) el.addEventListener('change', () => {
		boardFilters.project_id  = document.getElementById('kanbanProjectFilter').value;
		boardFilters.assigned_to = document.getElementById('kanbanAssigneeFilter').value;
		boardFilters.priority    = document.getElementById('kanbanPriorityFilter').value;
		loadBoard();
	});
});

const refreshBtn = document.getElementById('kanbanRefreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', loadBoard);

// ─── Task Detail Panel ────────────────────────────────────────────────────────

const detailPanel   = document.getElementById('taskDetailPanel');
const detailOverlay = document.getElementById('taskDetailOverlay');
const detailBody    = document.getElementById('taskDetailBody');
const detailTitle   = document.getElementById('detailTaskTitle');

function closeDetailPanel() {
	if (detailPanel) detailPanel.classList.add('hidden');
	if (detailOverlay) detailOverlay.classList.add('hidden');
}

const closePanelBtn = document.getElementById('closeDetailPanel');
if (closePanelBtn) closePanelBtn.addEventListener('click', closeDetailPanel);
if (detailOverlay) detailOverlay.addEventListener('click', closeDetailPanel);

async function openTaskDetail(taskId) {
	if (!detailPanel) return;
	detailPanel.classList.remove('hidden');
	if (detailOverlay) detailOverlay.classList.remove('hidden');
	detailBody.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div>';

	try {
		const data = await apiFetch(`/tasks/${taskId}`);
		const t = data.task;
		detailTitle.textContent = t.title;

		const priorityColors = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
		const statusColors   = { todo: '#94a3b8', in_progress: '#3b82f6', review: '#a855f7', completed: '#22c55e' };

		detailBody.innerHTML = `
			<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
				<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${priorityColors[t.priority]}22;color:${priorityColors[t.priority]}">${t.priority}</span>
				<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${statusColors[t.status]}22;color:${statusColors[t.status]}">${t.status.replace('_', ' ')}</span>
			</div>
			${t.description ? `<p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:14px;">${escHtml(t.description)}</p>` : ''}
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:14px;">
				<div><span style="color:var(--muted)">Project:</span> ${escHtml(t.project_name || '—')}</div>
				<div><span style="color:var(--muted)">Assignee:</span> ${escHtml(t.assigned_name || 'Unassigned')}</div>
				<div><span style="color:var(--muted)">Due:</span> ${t.due_date ? t.due_date.slice(0, 10) : '—'}</div>
				<div><span style="color:var(--muted)">Created:</span> ${timeAgo(t.created_at)}</div>
			</div>
			${(data.comments || []).length ? `
			<div style="margin-top:16px;">
				<h4 style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Comments</h4>
				${data.comments.slice(0, 5).map(c => `
					<div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:6px;">
						<p style="font-size:11px;color:#7fa7ff;font-weight:700;margin:0 0 4px;">${escHtml(c.author_name)}</p>
						<p style="font-size:12px;color:var(--text);margin:0;">${escHtml(c.content)}</p>
					</div>
				`).join('')}
			</div>` : ''}
			<div style="margin-top:16px;text-align:right;">
				<a href="/tasks-page" style="font-size:12px;color:#4f74ff;">Open in Tasks →</a>
			</div>
		`;
	} catch (err) {
		detailBody.innerHTML = `<p style="color:#ef4444;padding:20px;">${escHtml(err.message)}</p>`;
	}
}

document.addEventListener('keydown', e => {
	if (e.key === 'Escape') { closeDetailPanel(); closeSidebar(); }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
	await loadReferenceData();
	await loadBoard();
})();

function closeSidebar() {
	sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden');
}
