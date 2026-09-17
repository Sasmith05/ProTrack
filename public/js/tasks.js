/* tasks.js — Full task management page logic */

const CAN_MANAGE = window.__CAN_MANAGE_TASKS === true;
const SESSION_USER_ID = window.__SESSION_USER_ID || 0;
const SESSION_ROLE = window.__SESSION_ROLE || '';

let allProjects = [];
let allUsers = [];
let currentPage = 1;
const LIMIT = 20;
let currentFilters = {};
let currentSort = 'created_desc';
let activeTaskId = null;

// ─── Utility ─────────────────────────────────────────────────────────────────

function escHtml(s) {
	return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(v) {
	if (!v) return '—';
	const d = new Date(v);
	return isNaN(d) ? '—' : d.toISOString().slice(0, 10);
}

function priorityBadge(p) {
	return `<span class="priority-badge priority-badge--${escHtml(p)}">${escHtml(p)}</span>`;
}

function statusBadge(s) {
	return `<span class="status-badge status-badge--${escHtml(s)}">${escHtml(s.replace('_', ' '))}</span>`;
}

function fileIcon(mime) {
	if (!mime) return '📎';
	if (mime.startsWith('image/')) return '🖼';
	if (mime === 'application/pdf') return '📄';
	if (mime.includes('word')) return '📝';
	if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
	if (mime.includes('zip')) return '🗜';
	return '📎';
}

function formatBytes(bytes) {
	if (!bytes) return '';
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
	return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const sidebar = document.getElementById('mySidenav');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
	sidebar.classList.add('open'); sidebar.setAttribute('aria-hidden', 'false');
	sidebarOverlay.classList.remove('hidden'); sidebarOverlay.setAttribute('aria-hidden', 'false');
}
function closeSidebar() {
	sidebar.classList.remove('open'); sidebar.setAttribute('aria-hidden', 'true');
	sidebarOverlay.classList.add('hidden'); sidebarOverlay.setAttribute('aria-hidden', 'true');
}

document.getElementById('openSidebarBtn').addEventListener('click', openSidebar);
document.getElementById('closeSidebarBtn').addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// ─── Modals ───────────────────────────────────────────────────────────────────

function openModal(id) {
	const m = document.getElementById(id);
	if (!m) return;
	m.classList.remove('hidden');
	m.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
	const m = document.getElementById(id);
	if (!m) return;
	m.classList.add('hidden');
	m.setAttribute('aria-hidden', 'true');
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiRequest(url, options) {
	const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, ...options });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Request failed');
	return data;
}

// ─── Load reference data ──────────────────────────────────────────────────────

async function loadReferenceData() {
	try {
		const [projData, userDataRaw] = await Promise.allSettled([
			fetch('/projects', { headers: { Accept: 'application/json' } }).then(r => r.json()),
			fetch('/users', { headers: { Accept: 'application/json' } }).then(r => r.json())
		]);

		allProjects = (projData.status === 'fulfilled' ? projData.value.projects || [] : []);
		allUsers    = (userDataRaw.status === 'fulfilled' ? userDataRaw.value.users || [] : []);

		populateSelects();
	} catch (_e) {}
}

function populateSelects() {
	const projectOpt = allProjects.map(p => `<option value="${p.id}">${escHtml(p.project_name)}</option>`).join('');
	const userOpt    = allUsers.map(u => `<option value="${u.id}">${escHtml(u.first_name + ' ' + u.last_name)}</option>`).join('');

	['filterProject', 'addTaskProject', 'editTaskProject'].forEach(id => {
		const el = document.getElementById(id);
		if (!el) return;
		const prefix = id === 'filterProject' ? '<option value="">All Projects</option>' : '<option value="">— Select Project —</option>';
		el.innerHTML = prefix + projectOpt;
	});

	['filterAssignee', 'addTaskAssignee', 'editTaskAssignee'].forEach(id => {
		const el = document.getElementById(id);
		if (!el) return;
		const prefix = id === 'filterAssignee' ? '<option value="">All Users</option>' : '<option value="">— Unassigned —</option>';
		el.innerHTML = prefix + userOpt;
	});
}

// ─── Load & render tasks ──────────────────────────────────────────────────────

async function loadTasks(page) {
	page = page || 1;
	currentPage = page;

	const params = new URLSearchParams();
	params.set('page', page);
	params.set('limit', LIMIT);
	params.set('sort', currentSort);
	if (currentFilters.project_id) params.set('project_id', currentFilters.project_id);
	if (currentFilters.assigned_to) params.set('assigned_to', currentFilters.assigned_to);
	if (currentFilters.status) params.set('status', currentFilters.status);
	if (currentFilters.priority) params.set('priority', currentFilters.priority);
	if (currentFilters.q) params.set('q', currentFilters.q);

	const tbody = document.getElementById('tasksTableBody');
	const msgEl = document.getElementById('tasksMessage');
	tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading tasks...</td></tr>';

	try {
		const data = await apiRequest('/tasks?' + params.toString());
		const tasks = data.tasks || [];
		const p = data.pagination || {};

		document.getElementById('tasksCount').textContent = `${p.total || 0} tasks`;
		msgEl.textContent = '';

		if (!tasks.length) {
			tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No tasks found. Try adjusting your filters.</td></tr>';
			renderPagination(p);
			return;
		}

		tbody.innerHTML = tasks.map((t, i) => {
			const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
			return `<tr>
				<td class="task-title-cell" data-id="${t.id}">${escHtml(t.title)}</td>
				<td>${escHtml(t.project_name || '—')}</td>
				<td>${t.assigned_name ? `<span style="font-size:12px;">${escHtml(t.assigned_name)}</span>` : '<span style="color:var(--muted)">Unassigned</span>'}</td>
				<td>${priorityBadge(t.priority)}</td>
				<td>${statusBadge(t.status)}</td>
				<td style="color:${isOverdue ? '#ef4444' : 'inherit'};font-weight:${isOverdue ? '700' : '400'}">${formatDate(t.due_date)}</td>
				<td class="table-actions">
					<button class="action-btn view-btn" data-id="${t.id}" title="View Details">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
					</button>
					${CAN_MANAGE ? `
					<button class="action-btn edit-btn" data-index="${i}" title="Edit">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
					</button>
					<button class="action-btn delete delete-btn" data-id="${t.id}" title="Delete">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
					</button>` : ''}
				</td>
			</tr>`;
		}).join('');

		// Store tasks for edit by index
		window.__tasks = tasks;
		renderPagination(p);
	} catch (err) {
		msgEl.textContent = err.message;
		msgEl.className = 'status-text error';
		tbody.innerHTML = '';
	}
}

function renderPagination(p) {
	const wrap = document.getElementById('tasksPagination');
	if (!wrap) return;
	if (!p.totalPages || p.totalPages <= 1) { wrap.innerHTML = ''; return; }
	let html = '<div class="pagination">';
	if (p.page > 1) html += `<button onclick="loadTasks(${p.page - 1})">← Prev</button>`;
	html += `<span>Page ${p.page} of ${p.totalPages}</span>`;
	if (p.page < p.totalPages) html += `<button onclick="loadTasks(${p.page + 1})">Next →</button>`;
	html += '</div>';
	wrap.innerHTML = html;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

document.getElementById('applyFiltersBtn').addEventListener('click', () => {
	currentFilters = {
		project_id:  document.getElementById('filterProject').value,
		assigned_to: document.getElementById('filterAssignee').value,
		status:      document.getElementById('filterStatus').value,
		priority:    document.getElementById('filterPriority').value,
		q:           document.getElementById('taskSearchInput').value.trim()
	};
	loadTasks(1);
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
	document.getElementById('filterProject').value  = '';
	document.getElementById('filterAssignee').value = '';
	document.getElementById('filterStatus').value   = '';
	document.getElementById('filterPriority').value = '';
	document.getElementById('taskSearchInput').value = '';
	currentFilters = {};
	loadTasks(1);
});

document.getElementById('taskSort').addEventListener('change', e => {
	currentSort = e.target.value;
	loadTasks(1);
});

// Search on Enter key
document.getElementById('taskSearchInput').addEventListener('keydown', e => {
	if (e.key === 'Enter') document.getElementById('applyFiltersBtn').click();
});

// ─── Table click delegation ───────────────────────────────────────────────────

document.getElementById('tasksTableBody').addEventListener('click', function (e) {
	const viewBtn   = e.target.closest('.view-btn');
	const titleCell = e.target.closest('.task-title-cell');
	const editBtn   = e.target.closest('.edit-btn');
	const deleteBtn = e.target.closest('.delete-btn');

	if (viewBtn || titleCell) {
		const id = (viewBtn || titleCell).dataset.id;
		if (id) openTaskDetail(Number(id));
	} else if (editBtn && CAN_MANAGE) {
		const idx = Number(editBtn.dataset.index);
		openEditModal(idx);
	} else if (deleteBtn && CAN_MANAGE) {
		confirmDeleteTask(Number(deleteBtn.dataset.id));
	}
});

// ─── Add Task Modal ───────────────────────────────────────────────────────────

if (document.getElementById('openAddTaskModal')) {
	document.getElementById('openAddTaskModal').addEventListener('click', () => {
		document.getElementById('addTaskForm').reset();
		openModal('addTaskModal');
	});
}

function closeAddModal() {
	closeModal('addTaskModal');
	document.getElementById('addTaskForm').reset();
}

const closeAddBtn = document.getElementById('closeAddTaskModal');
const cancelAddBtn = document.getElementById('cancelAddTask');
if (closeAddBtn) closeAddBtn.addEventListener('click', closeAddModal);
if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeAddModal);

const addTaskForm = document.getElementById('addTaskForm');
if (addTaskForm) {
	addTaskForm.addEventListener('submit', async function (e) {
		e.preventDefault();
		const submitBtn = this.querySelector('[type=submit]');
		submitBtn.textContent = 'Creating...';
		submitBtn.disabled = true;
		try {
			await apiRequest('/tasks', {
				method: 'POST',
				body: JSON.stringify({
					title:          document.getElementById('addTaskTitle').value.trim(),
					projectId:      document.getElementById('addTaskProject').value,
					assignedTo:     document.getElementById('addTaskAssignee').value,
					description:    document.getElementById('addTaskDescription').value.trim(),
					priority:       document.getElementById('addTaskPriority').value,
					status:         document.getElementById('addTaskStatus').value,
					estimatedHours: document.getElementById('addTaskEstHours').value,
					startDate:      document.getElementById('addTaskStartDate').value,
					dueDate:        document.getElementById('addTaskDueDate').value
				})
			});
			showToast('Task created successfully!', 'success');
			closeAddModal();
			loadTasks(currentPage);
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			submitBtn.textContent = 'Create Task';
			submitBtn.disabled = false;
		}
	});
}

// ─── Edit Task Modal ──────────────────────────────────────────────────────────

function openEditModal(idx) {
	const t = (window.__tasks || [])[idx];
	if (!t) return;
	document.getElementById('editTaskId').value       = t.id;
	document.getElementById('editTaskTitle').value    = t.title || '';
	document.getElementById('editTaskProject').value  = t.project_id || '';
	document.getElementById('editTaskAssignee').value = t.assigned_to || '';
	document.getElementById('editTaskDescription').value = t.description || '';
	document.getElementById('editTaskPriority').value = t.priority || 'medium';
	document.getElementById('editTaskStatus').value   = t.status || 'todo';
	document.getElementById('editTaskEstHours').value = t.estimated_hours || '';
	document.getElementById('editTaskActHours').value = t.actual_hours || '';
	document.getElementById('editTaskStartDate').value = formatDate(t.start_date) === '—' ? '' : formatDate(t.start_date);
	document.getElementById('editTaskDueDate').value  = formatDate(t.due_date) === '—' ? '' : formatDate(t.due_date);
	openModal('editTaskModal');
}

const closeEditBtn = document.getElementById('closeEditTaskModal');
const cancelEditBtn = document.getElementById('cancelEditTask');
if (closeEditBtn) closeEditBtn.addEventListener('click', () => closeModal('editTaskModal'));
if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal('editTaskModal'));

const editTaskForm = document.getElementById('editTaskForm');
if (editTaskForm) {
	editTaskForm.addEventListener('submit', async function (e) {
		e.preventDefault();
		const taskId = document.getElementById('editTaskId').value;
		const submitBtn = this.querySelector('[type=submit]');
		submitBtn.textContent = 'Saving...';
		submitBtn.disabled = true;
		try {
			await apiRequest(`/tasks/${taskId}`, {
				method: 'PUT',
				body: JSON.stringify({
					title:          document.getElementById('editTaskTitle').value.trim(),
					projectId:      document.getElementById('editTaskProject').value,
					assignedTo:     document.getElementById('editTaskAssignee').value,
					description:    document.getElementById('editTaskDescription').value.trim(),
					priority:       document.getElementById('editTaskPriority').value,
					status:         document.getElementById('editTaskStatus').value,
					estimatedHours: document.getElementById('editTaskEstHours').value,
					actualHours:    document.getElementById('editTaskActHours').value,
					startDate:      document.getElementById('editTaskStartDate').value,
					dueDate:        document.getElementById('editTaskDueDate').value
				})
			});
			showToast('Task updated successfully!', 'success');
			closeModal('editTaskModal');
			loadTasks(currentPage);
			if (activeTaskId === Number(taskId)) openTaskDetail(Number(taskId));
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			submitBtn.textContent = 'Save Changes';
			submitBtn.disabled = false;
		}
	});
}

// ─── Delete Task ──────────────────────────────────────────────────────────────

function confirmDeleteTask(id) {
	showConfirm('Delete Task?', 'This action cannot be undone.', async () => {
		try {
			await apiRequest(`/tasks/${id}`, { method: 'DELETE' });
			showToast('Task deleted.', 'success');
			loadTasks(currentPage);
			if (activeTaskId === id) closeDetailPanel();
		} catch (err) {
			showToast(err.message, 'error');
		}
	});
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

const detailPanel   = document.getElementById('taskDetailPanel');
const detailOverlay = document.getElementById('taskDetailOverlay');
const detailBody    = document.getElementById('taskDetailBody');
const detailTitle   = document.getElementById('detailTaskTitle');

function closeDetailPanel() {
	activeTaskId = null;
	if (detailPanel) detailPanel.classList.add('hidden');
	if (detailOverlay) detailOverlay.classList.add('hidden');
}

const closePanelBtn = document.getElementById('closeDetailPanel');
if (closePanelBtn) closePanelBtn.addEventListener('click', closeDetailPanel);
if (detailOverlay) detailOverlay.addEventListener('click', closeDetailPanel);

async function openTaskDetail(taskId) {
	activeTaskId = taskId;
	detailPanel.classList.remove('hidden');
	detailOverlay.classList.remove('hidden');
	detailBody.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div>';

	try {
		const data = await apiRequest(`/tasks/${taskId}`);
		const t = data.task;
		const comments = data.comments || [];
		const attachments = data.attachments || [];

		detailTitle.textContent = t.title || 'Task Details';

		const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
		const progress = t.estimated_hours && t.actual_hours
			? Math.min(100, Math.round((t.actual_hours / t.estimated_hours) * 100))
			: (t.status === 'completed' ? 100 : 0);

		detailBody.innerHTML = `
			<div class="detail-section">
				<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
					${priorityBadge(t.priority)} ${statusBadge(t.status)}
				</div>
				${t.description ? `<div class="detail-description">${escHtml(t.description)}</div>` : ''}
			</div>

			<div class="detail-section">
				<h4>Details</h4>
				<div class="detail-meta-grid">
					<div class="detail-meta-item"><label>Project</label><span>${escHtml(t.project_name || '—')}</span></div>
					<div class="detail-meta-item"><label>Assignee</label><span>${escHtml(t.assigned_name || 'Unassigned')}</span></div>
					<div class="detail-meta-item"><label>Start Date</label><span>${formatDate(t.start_date)}</span></div>
					<div class="detail-meta-item"><label>Due Date</label><span style="color:${isOverdue ? '#ef4444' : 'inherit'}">${formatDate(t.due_date)}</span></div>
					<div class="detail-meta-item"><label>Est. Hours</label><span>${t.estimated_hours || '—'}</span></div>
					<div class="detail-meta-item"><label>Actual Hours</label><span>${t.actual_hours || '—'}</span></div>
					${t.completed_date ? `<div class="detail-meta-item"><label>Completed</label><span>${formatDate(t.completed_date)}</span></div>` : ''}
					<div class="detail-meta-item"><label>Created by</label><span>${escHtml(t.created_by_name || '—')}</span></div>
				</div>
				${t.estimated_hours ? `
				<div style="margin-top:12px;">
					<label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;">Progress</label>
					<div style="display:flex;align-items:center;gap:8px;">
						<div class="progress-bar-wrap" style="height:6px;"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
						<span style="font-size:12px;color:var(--muted);">${progress}%</span>
					</div>
				</div>` : ''}
			</div>

			<div class="detail-section" id="attachmentsSection">
				<h4>Attachments (${attachments.length})</h4>
				<div id="attachmentsList">
					${attachments.length ? attachments.map(a => buildAttachmentHtml(a)).join('') : '<p style="font-size:12px;color:var(--muted)">No attachments.</p>'}
				</div>
				<div class="upload-form" id="uploadForm">
					<input type="file" id="attachmentFile" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip">
					<button type="button" class="btn-primary btn-sm" id="uploadAttBtn">Upload</button>
				</div>
			</div>

			<div class="detail-section" id="commentsSection">
				<h4>Comments (${comments.length})</h4>
				<div id="commentsList">
					${comments.length ? comments.map(c => buildCommentHtml(c)).join('') : '<p style="font-size:12px;color:var(--muted)">No comments yet.</p>'}
				</div>
				<div class="comment-form" style="margin-top:12px;">
					<textarea id="newCommentInput" class="comment-input" rows="2" placeholder="Add a comment..."></textarea>
					<button type="button" class="btn-primary btn-sm" id="addCommentBtn">Post</button>
				</div>
			</div>
		`;

		// Bind comment events
		const addCommentBtn = document.getElementById('addCommentBtn');
		if (addCommentBtn) addCommentBtn.addEventListener('click', () => addComment(taskId));

		const newCommentInput = document.getElementById('newCommentInput');
		if (newCommentInput) {
			newCommentInput.addEventListener('keydown', e => {
				if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(taskId);
			});
		}

		// Bind upload event
		const uploadAttBtn = document.getElementById('uploadAttBtn');
		if (uploadAttBtn) uploadAttBtn.addEventListener('click', () => uploadAttachment(taskId));

		// Bind comment action buttons
		bindCommentActions(taskId);
		bindAttachmentActions(taskId);

	} catch (err) {
		detailBody.innerHTML = `<div style="padding:20px;color:#ef4444;">${escHtml(err.message)}</div>`;
	}
}

function buildAttachmentHtml(a) {
	const canDelete = a.uploaded_by === SESSION_USER_ID || ['super_admin','admin'].includes(SESSION_ROLE);
	return `<div class="attachment-item" data-id="${a.id}">
		<span class="attachment-icon">${fileIcon(a.mime_type)}</span>
		<div class="attachment-info">
			<div class="attachment-name">${escHtml(a.original_name)}</div>
			<div class="attachment-size">${formatBytes(a.file_size)}</div>
		</div>
		<div class="attachment-actions">
			<a href="${escHtml(a.file_path)}" download class="action-btn" title="Download" style="text-decoration:none;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
			</a>
			${canDelete ? `<button class="action-btn delete del-att-btn" data-id="${a.id}" title="Delete">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
			</button>` : ''}
		</div>
	</div>`;
}

function buildCommentHtml(c) {
	const canEdit   = c.user_id === SESSION_USER_ID || SESSION_ROLE === 'super_admin';
	const canDelete = c.user_id === SESSION_USER_ID || ['super_admin','admin'].includes(SESSION_ROLE);
	const dateStr   = new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
	return `<div class="comment-item" data-id="${c.id}">
		<div class="comment-author">
			<span class="comment-author-name">${escHtml(c.author_name)}</span>
			<span class="comment-date">${dateStr}${c.is_edited ? ' <span class="comment-edited">(edited)</span>' : ''}</span>
		</div>
		<p class="comment-content">${escHtml(c.content)}</p>
		<div class="comment-actions">
			${canEdit ? `<button class="comment-btn edit-comment-btn" data-id="${c.id}" data-content="${escHtml(c.content)}">Edit</button>` : ''}
			${canDelete ? `<button class="comment-btn delete-comment-btn" data-id="${c.id}" style="color:#ef4444;">Delete</button>` : ''}
		</div>
	</div>`;
}

function bindCommentActions(taskId) {
	const commentsList = document.getElementById('commentsList');
	if (!commentsList) return;
	commentsList.addEventListener('click', async e => {
		const editBtn = e.target.closest('.edit-comment-btn');
		const delBtn  = e.target.closest('.delete-comment-btn');
		if (editBtn) {
			const id = Number(editBtn.dataset.id);
			const newContent = prompt('Edit comment:', editBtn.dataset.content);
			if (newContent === null || !newContent.trim()) return;
			try {
				await apiRequest(`/tasks/${taskId}/comments/${id}`, { method: 'PUT', body: JSON.stringify({ content: newContent.trim() }) });
				showToast('Comment updated', 'success');
				openTaskDetail(taskId);
			} catch (err) { showToast(err.message, 'error'); }
		} else if (delBtn) {
			const id = Number(delBtn.dataset.id);
			showConfirm('Delete comment?', 'This cannot be undone.', async () => {
				try {
					await apiRequest(`/tasks/${taskId}/comments/${id}`, { method: 'DELETE' });
					showToast('Comment deleted', 'success');
					openTaskDetail(taskId);
				} catch (err) { showToast(err.message, 'error'); }
			});
		}
	});
}

function bindAttachmentActions(taskId) {
	const attList = document.getElementById('attachmentsList');
	if (!attList) return;
	attList.addEventListener('click', async e => {
		const delBtn = e.target.closest('.del-att-btn');
		if (!delBtn) return;
		const id = Number(delBtn.dataset.id);
		showConfirm('Delete attachment?', 'This cannot be undone.', async () => {
			try {
				await apiRequest(`/tasks/${taskId}/attachments/${id}`, { method: 'DELETE' });
				showToast('Attachment deleted', 'success');
				openTaskDetail(taskId);
			} catch (err) { showToast(err.message, 'error'); }
		});
	});
}

async function addComment(taskId) {
	const input = document.getElementById('newCommentInput');
	const content = input ? input.value.trim() : '';
	if (!content) return;
	try {
		await apiRequest(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
		showToast('Comment added!', 'success');
		openTaskDetail(taskId);
	} catch (err) { showToast(err.message, 'error'); }
}

async function uploadAttachment(taskId) {
	const fileInput = document.getElementById('attachmentFile');
	if (!fileInput || !fileInput.files.length) { showToast('Please select a file', 'warning'); return; }
	const file = fileInput.files[0];
	const formData = new FormData();
	formData.append('attachment', file);
	try {
		const res = await fetch(`/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || 'Upload failed');
		showToast('File uploaded!', 'success');
		openTaskDetail(taskId);
	} catch (err) { showToast(err.message, 'error'); }
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function showConfirm(title, message, onConfirm) {
	const overlay = document.createElement('div');
	overlay.className = 'confirm-dialog-overlay';
	overlay.innerHTML = `
		<div class="confirm-dialog">
			<h4>${escHtml(title)}</h4>
			<p>${escHtml(message)}</p>
			<div class="confirm-dialog-actions">
				<button class="btn-primary" id="confirmYesBtn">Yes, proceed</button>
				<button class="btn-secondary" id="confirmNoBtn">Cancel</button>
			</div>
		</div>
	`;
	document.body.appendChild(overlay);
	overlay.querySelector('#confirmYesBtn').addEventListener('click', () => { document.body.removeChild(overlay); onConfirm(); });
	overlay.querySelector('#confirmNoBtn').addEventListener('click', () => document.body.removeChild(overlay));
}

// ─── ESC to close ─────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
	if (e.key === 'Escape') {
		closeDetailPanel();
		closeModal('addTaskModal');
		closeModal('editTaskModal');
		closeSidebar();
	}
});

// ─── Modal overlay click ──────────────────────────────────────────────────────
['addTaskModal', 'editTaskModal'].forEach(id => {
	const el = document.getElementById(id);
	if (el) el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadReferenceData().then(() => loadTasks(1));
