let projects = [];

const CAN_MANAGE = window.__CAN_MANAGE === true;

const projectsMessage = document.getElementById('projectsMessage');
const projectsTableBody = document.getElementById('projectsTableBody');
const sideNav = document.getElementById('mySidenav');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Modal elements — may be null for employees (not rendered in HTML)
const addProjectForm = document.getElementById('addProjectForm');
const addProjectMessage = document.getElementById('addProjectMessage');
const editProjectModal = document.getElementById('editProjectModal');
const editProjectForm = document.getElementById('editProjectForm');
const editProjectMessage = document.getElementById('editProjectMessage');
const addProjectModal = document.getElementById('addProjectModal');

const PROJECT_STATUSES = ['ongoing', 'completed', 'on_hold'];

function openNav() {
	if (!sideNav) return;
	sideNav.classList.add('open');
	sideNav.setAttribute('aria-hidden', 'false');
	if (sidebarOverlay) {
		sidebarOverlay.classList.remove('hidden');
		sidebarOverlay.setAttribute('aria-hidden', 'false');
	}
}

function closeNav() {
	if (!sideNav) return;
	sideNav.classList.remove('open');
	sideNav.setAttribute('aria-hidden', 'true');
	if (sidebarOverlay) {
		sidebarOverlay.classList.add('hidden');
		sidebarOverlay.setAttribute('aria-hidden', 'true');
	}
}

function openAddProjectModal() {
	if (!addProjectModal) return;
	showMessage(addProjectMessage, '');
	addProjectModal.classList.remove('hidden');
	addProjectModal.setAttribute('aria-hidden', 'false');
}

function closeAddProjectModal() {
	if (!addProjectModal) return;
	addProjectForm.reset();
	showMessage(addProjectMessage, '');
	addProjectModal.classList.add('hidden');
	addProjectModal.setAttribute('aria-hidden', 'true');
}

function showMessage(element, text, type) {
	if (!element) return;
	element.innerText = text || '';
	element.className = 'status-text';
	if (type) element.classList.add(type);
}

async function getResponseData(response) {
	const text = await response.text();
	if (!text) return {};
	try {
		return JSON.parse(text);
	} catch (_err) {
		return { error: 'Invalid server response' };
	}
}

function formatDate(value) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 10);
}

function createCell(text) {
	const cell = document.createElement('td');
	cell.textContent = text || '';
	return cell;
}

function createStatusCell(status) {
	const cell = document.createElement('td');
	const badge = document.createElement('span');
	const safeStatus = PROJECT_STATUSES.includes(status) ? status : 'ongoing';
	badge.className = `status-pill status-${safeStatus}`;
	badge.textContent = safeStatus.replace(/_/g, ' ');
	cell.appendChild(badge);
	return cell;
}

function renderProjectsTable() {
	projectsTableBody.innerHTML = '';

	if (projects.length === 0) {
		showMessage(projectsMessage, 'No projects found.');
		return;
	}

	showMessage(projectsMessage, '');

	for (let i = 0; i < projects.length; i += 1) {
		const project = projects[i];
		const row = document.createElement('tr');

		row.appendChild(createCell(project.project_name));
		row.appendChild(createCell(project.description));
		row.appendChild(createCell(formatDate(project.start_date)));
		row.appendChild(createCell(formatDate(project.end_date)));
		row.appendChild(createStatusCell(project.status));

		if (CAN_MANAGE) {
			const actionCell = document.createElement('td');
			actionCell.className = 'table-actions';

			const editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.className = 'edit-button';
			editButton.innerText = 'Edit';
			editButton.dataset.index = String(i);
			actionCell.appendChild(editButton);

			const deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'delete-button';
			deleteButton.innerText = 'Delete';
			deleteButton.dataset.id = String(project.id);
			actionCell.appendChild(deleteButton);

			row.appendChild(actionCell);
		}

		projectsTableBody.appendChild(row);
	}
}

async function loadProjects() {
	try {
		const response = await fetch('/projects', { headers: { Accept: 'application/json' } });
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to load projects');

		projects = data.projects || [];
		renderProjectsTable();
	} catch (error) {
		projects = [];
		projectsTableBody.innerHTML = '';
		showMessage(projectsMessage, error.message || 'Unable to load projects', 'error');
	}
}

function openEditFormByIndex(index) {
	if (!editProjectModal) return;
	const project = projects[index];
	if (!project) return;

	document.getElementById('editProjectId').value = project.id;
	document.getElementById('editProjectName').value = project.project_name || '';
	document.getElementById('editProjectDescription').value = project.description || '';
	document.getElementById('editProjectStartDate').value = formatDate(project.start_date);
	document.getElementById('editProjectEndDate').value = formatDate(project.end_date);

	const statusEl = document.getElementById('editProjectStatus');
	if (statusEl) statusEl.value = PROJECT_STATUSES.includes(project.status) ? project.status : 'ongoing';

	showMessage(editProjectMessage, '');
	editProjectModal.classList.remove('hidden');
	editProjectModal.setAttribute('aria-hidden', 'false');
}

function closeEditForm() {
	if (!editProjectModal) return;
	editProjectForm.reset();
	showMessage(editProjectMessage, '');
	editProjectModal.classList.add('hidden');
	editProjectModal.setAttribute('aria-hidden', 'true');
}

async function handleAddProject(event) {
	event.preventDefault();

	const statusEl = document.getElementById('addProjectStatus');
	const payload = {
		projectName: document.getElementById('addProjectName').value.trim(),
		description: document.getElementById('addProjectDescription').value.trim(),
		startDate: document.getElementById('addProjectStartDate').value,
		endDate: document.getElementById('addProjectEndDate').value,
		status: statusEl ? statusEl.value : 'ongoing'
	};

	if (!payload.projectName || !payload.description || !payload.startDate || !payload.endDate) {
		showMessage(addProjectMessage, 'All fields are required.', 'error');
		return;
	}

	if (payload.startDate > payload.endDate) {
		showMessage(addProjectMessage, 'Start date cannot be after end date.', 'error');
		return;
	}

	try {
		const response = await fetch('/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to add project');

		addProjectForm.reset();
		showMessage(addProjectMessage, 'Project added successfully.', 'success');
		await loadProjects();
		closeAddProjectModal();
	} catch (error) {
		showMessage(addProjectMessage, error.message || 'Unable to add project', 'error');
	}
}

async function handleEditProject(event) {
	event.preventDefault();

	const projectId = document.getElementById('editProjectId').value.trim();
	const statusEl = document.getElementById('editProjectStatus');
	const payload = {
		projectName: document.getElementById('editProjectName').value.trim(),
		description: document.getElementById('editProjectDescription').value.trim(),
		startDate: document.getElementById('editProjectStartDate').value,
		endDate: document.getElementById('editProjectEndDate').value,
		status: statusEl ? statusEl.value : 'ongoing'
	};

	if (!projectId || !/^\d+$/.test(projectId)) {
		showMessage(editProjectMessage, 'Invalid project selected for update.', 'error');
		return;
	}

	if (!payload.projectName || !payload.description || !payload.startDate || !payload.endDate) {
		showMessage(editProjectMessage, 'All fields are required.', 'error');
		return;
	}

	if (payload.startDate > payload.endDate) {
		showMessage(editProjectMessage, 'Start date cannot be after end date.', 'error');
		return;
	}

	try {
		const updateUrl = new URL(`/projects/${encodeURIComponent(projectId)}`, window.location.origin);
		const response = await fetch(updateUrl.toString(), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to update project');

		showMessage(editProjectMessage, 'Project updated successfully.', 'success');
		await loadProjects();
		closeEditForm();
	} catch (error) {
		showMessage(editProjectMessage, error.message || 'Unable to update project', 'error');
	}
}

async function handleDeleteProject(projectId) {
	if (!projectId || !/^\d+$/.test(projectId)) {
		showMessage(projectsMessage, 'Invalid project selected for delete.', 'error');
		return;
	}

	if (!window.confirm('Delete this project?')) return;

	try {
		const deleteUrl = new URL(`/projects/${encodeURIComponent(projectId)}`, window.location.origin);
		const response = await fetch(deleteUrl.toString(), {
			method: 'DELETE',
			headers: { Accept: 'application/json' }
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to delete project');

		if (editProjectModal && document.getElementById('editProjectId').value === projectId) {
			closeEditForm();
		}

		showMessage(projectsMessage, 'Project deleted successfully.', 'success');
		await loadProjects();
	} catch (error) {
		showMessage(projectsMessage, error.message || 'Unable to delete project', 'error');
	}
}

// ─── Event listeners ─────────────────────────────────────────────────────────

projectsTableBody.addEventListener('click', function (event) {
	const editButton = event.target.closest('.edit-button');
	if (editButton) {
		openEditFormByIndex(Number(editButton.dataset.index));
		return;
	}

	const deleteButton = event.target.closest('.delete-button');
	if (deleteButton) handleDeleteProject(deleteButton.dataset.id);
});

if (addProjectForm) addProjectForm.addEventListener('submit', handleAddProject);
if (editProjectForm) editProjectForm.addEventListener('submit', handleEditProject);

const cancelEdit = document.getElementById('cancelProjectEdit');
if (cancelEdit) cancelEdit.addEventListener('click', closeEditForm);

const closeEditBtn = document.getElementById('closeEditProjectModal');
if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditForm);

const openAddBtn = document.getElementById('openAddProjectModal');
if (openAddBtn) openAddBtn.addEventListener('click', openAddProjectModal);

const closeAddBtn = document.getElementById('closeAddProjectModal');
if (closeAddBtn) closeAddBtn.addEventListener('click', closeAddProjectModal);

const cancelAdd = document.getElementById('cancelAddProject');
if (cancelAdd) cancelAdd.addEventListener('click', closeAddProjectModal);

document.getElementById('openSidebarBtn').addEventListener('click', openNav);
document.getElementById('closeSidebarBtn').addEventListener('click', closeNav);

if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeNav);

document.addEventListener('keydown', function (event) {
	if (event.key === 'Escape') {
		closeAddProjectModal();
		closeEditForm();
		closeNav();
	}
});

if (addProjectModal) {
	addProjectModal.addEventListener('click', function (event) {
		if (event.target === addProjectModal) closeAddProjectModal();
	});
}

if (editProjectModal) {
	editProjectModal.addEventListener('click', function (event) {
		if (event.target === editProjectModal) closeEditForm();
	});
}

loadProjects();
