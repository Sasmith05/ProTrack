let users = [];

const USER_STATUS = Object.freeze({ ACTIVE: 'active', INACTIVE: 'inactive' });
const SESSION_ROLE = window.__SESSION_ROLE || '';

function normalizeUserStatus(value) {
	if (typeof value !== 'string') return USER_STATUS.INACTIVE;
	const normalized = value.trim().toLowerCase();
	return normalized === USER_STATUS.ACTIVE ? USER_STATUS.ACTIVE : USER_STATUS.INACTIVE;
}

const usersMessage = document.getElementById('usersMessage');
const usersTableBody = document.getElementById('usersTableBody');
const addUserForm = document.getElementById('addUserForm');
const addUserMessage = document.getElementById('addUserMessage');
const editUserModal = document.getElementById('editUserModal');
const editUserForm = document.getElementById('editUserForm');
const editUserMessage = document.getElementById('editUserMessage');
const addUserModal = document.getElementById('addUserModal');
const sideNav = document.getElementById('mySidenav');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

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

function openAddUserModal() {
	showMessage(addUserMessage, '');
	addUserModal.classList.remove('hidden');
	addUserModal.setAttribute('aria-hidden', 'false');
}

function closeAddUserModal() {
	addUserForm.reset();
	showMessage(addUserMessage, '');
	addUserModal.classList.add('hidden');
	addUserModal.setAttribute('aria-hidden', 'true');
}

function showMessage(element, text, type) {
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

function createCell(text) {
	const cell = document.createElement('td');
	cell.textContent = text || '';
	return cell;
}

function createStatusCell(statusValue) {
	const cell = document.createElement('td');
	const status = normalizeUserStatus(statusValue);
	const badge = document.createElement('span');
	badge.className = `status-pill status-${status}`;
	badge.textContent = status === USER_STATUS.ACTIVE ? 'Active' : 'Inactive';
	cell.appendChild(badge);
	return cell;
}

function createRoleCell(role) {
	const cell = document.createElement('td');
	const badge = document.createElement('span');
	badge.className = `role-pill role-${role || 'employee'}`;
	badge.textContent = (role || 'employee').replace(/_/g, ' ');
	cell.appendChild(badge);
	return cell;
}

function createActionIcon(pathData, viewBox) {
	const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	icon.setAttribute('viewBox', viewBox);
	icon.setAttribute('aria-hidden', 'true');
	icon.classList.add('action-icon');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', pathData);
	path.setAttribute('fill', 'currentColor');
	icon.appendChild(path);
	return icon;
}

function renderUsersTable() {
	usersTableBody.innerHTML = '';

	if (users.length === 0) {
		showMessage(usersMessage, 'No users found.');
		return;
	}

	showMessage(usersMessage, '');

	for (let i = 0; i < users.length; i += 1) {
		const user = users[i];
		const row = document.createElement('tr');

		const actionCell = document.createElement('td');
		actionCell.className = 'table-actions';

		const editButton = document.createElement('button');
		editButton.type = 'button';
		editButton.className = 'edit-button';
		editButton.setAttribute('aria-label', 'Edit user');
		editButton.title = 'Edit';
		editButton.appendChild(
			createActionIcon(
				'M3 17.25V21h3.75l11-11-3.75-3.75-11 11zm17.71-10.04a1.003 1.003 0 000-1.42l-2.5-2.5a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 2-2.66z',
				'0 0 24 24'
			)
		);
		editButton.dataset.index = String(i);
		actionCell.appendChild(editButton);

		// Only super_admin can delete super_admin accounts; admin can delete others
		const canDelete =
			SESSION_ROLE === 'super_admin' ||
			(SESSION_ROLE === 'admin' && user.role !== 'super_admin');

		if (canDelete) {
			const deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'delete-button';
			deleteButton.setAttribute('aria-label', 'Delete user');
			deleteButton.title = 'Delete';
			deleteButton.appendChild(
				createActionIcon(
					'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
					'0 0 24 24'
				)
			);
			deleteButton.dataset.id = String(user.id);
			actionCell.appendChild(deleteButton);
		}

		row.appendChild(actionCell);
		row.appendChild(createCell(user.first_name));
		row.appendChild(createCell(user.last_name));
		row.appendChild(createCell(user.phone));
		row.appendChild(createCell(user.email));
		row.appendChild(createRoleCell(user.role));
		row.appendChild(createStatusCell(user.status));

		usersTableBody.appendChild(row);
	}
}

async function loadUsers() {
	try {
		const response = await fetch('/users', { headers: { Accept: 'application/json' } });
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to load users');

		users = data.users || [];
		renderUsersTable();
	} catch (error) {
		users = [];
		usersTableBody.innerHTML = '';
		showMessage(usersMessage, error.message || 'Unable to load users', 'error');
	}
}

function openEditFormByIndex(index) {
	const user = users[index];
	if (!user) return;

	document.getElementById('editUserId').value = user.id;
	document.getElementById('editFirstName').value = user.first_name || '';
	document.getElementById('editLastName').value = user.last_name || '';
	document.getElementById('editPhone').value = user.phone || '';
	document.getElementById('editEmail').value = user.email || '';
	document.getElementById('editStatus').value = normalizeUserStatus(user.status);

	const editRoleEl = document.getElementById('editRole');
	if (editRoleEl) {
		// Set matching option; if super_admin option is absent for admin role, fall back to admin
		const opt = editRoleEl.querySelector(`option[value="${user.role}"]`);
		editRoleEl.value = opt ? user.role : 'admin';
	}

	showMessage(editUserMessage, '');
	editUserModal.classList.remove('hidden');
	editUserModal.setAttribute('aria-hidden', 'false');
}

function closeEditForm() {
	editUserForm.reset();
	showMessage(editUserMessage, '');
	editUserModal.classList.add('hidden');
	editUserModal.setAttribute('aria-hidden', 'true');
}

function togglePasswordVisibility(targetId, toggleButton) {
	const input = document.getElementById(targetId);
	if (!input) return;
	if (input.type === 'password') {
		input.type = 'text';
		toggleButton.classList.add('active');
	} else {
		input.type = 'password';
		toggleButton.classList.remove('active');
	}
}

async function handleAddUser(event) {
	event.preventDefault();

	const roleEl = document.getElementById('addRole');
	const payload = {
		firstName: document.getElementById('addFirstName').value.trim(),
		lastName: document.getElementById('addLastName').value.trim(),
		phone: document.getElementById('addPhone').value.trim(),
		email: document.getElementById('addEmail').value.trim(),
		password: document.getElementById('addPassword').value,
		status: normalizeUserStatus(document.getElementById('addStatus').value),
		role: roleEl ? roleEl.value : 'employee'
	};

	if (!payload.firstName || !payload.lastName || !payload.phone || !payload.email || !payload.password) {
		showMessage(addUserMessage, 'All fields are required.', 'error');
		return;
	}

	try {
		const response = await fetch('/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to add user');

		addUserForm.reset();
		showMessage(addUserMessage, 'User added successfully.', 'success');
		await loadUsers();
		closeAddUserModal();
	} catch (error) {
		showMessage(addUserMessage, error.message || 'Unable to add user', 'error');
	}
}

async function handleEditUser(event) {
	event.preventDefault();

	const userId = document.getElementById('editUserId').value.trim();
	const editRoleEl = document.getElementById('editRole');
	const payload = {
		firstName: document.getElementById('editFirstName').value.trim(),
		lastName: document.getElementById('editLastName').value.trim(),
		phone: document.getElementById('editPhone').value.trim(),
		email: document.getElementById('editEmail').value.trim(),
		status: normalizeUserStatus(document.getElementById('editStatus').value),
		role: editRoleEl ? editRoleEl.value : 'employee'
	};

	if (!userId || !/^\d+$/.test(userId)) {
		showMessage(editUserMessage, 'Invalid user selected for update.', 'error');
		return;
	}

	if (!payload.firstName || !payload.lastName || !payload.phone || !payload.email) {
		showMessage(editUserMessage, 'All fields are required.', 'error');
		return;
	}

	try {
		const updateUrl = new URL(`/users/${encodeURIComponent(userId)}`, window.location.origin);
		const response = await fetch(updateUrl.toString(), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to update user');

		showMessage(editUserMessage, 'User updated successfully.', 'success');
		await loadUsers();
		closeEditForm();
	} catch (error) {
		const message =
			error && error.name === 'TypeError'
				? 'Cannot reach server. Check if the backend is running.'
				: error.message || 'Unable to update user';
		showMessage(editUserMessage, message, 'error');
	}
}

async function handleDeleteUser(userId) {
	if (!userId || !/^\d+$/.test(userId)) {
		showMessage(usersMessage, 'Invalid user selected for delete.', 'error');
		return;
	}

	if (!window.confirm('Delete this user?')) return;

	try {
		const deleteUrl = new URL(`/users/${encodeURIComponent(userId)}`, window.location.origin);
		const response = await fetch(deleteUrl.toString(), {
			method: 'DELETE',
			headers: { Accept: 'application/json' }
		});
		const data = await getResponseData(response);

		if (!response.ok) throw new Error(data.error || 'Unable to delete user');

		if (document.getElementById('editUserId').value === userId) closeEditForm();

		showMessage(usersMessage, 'User deleted successfully.', 'success');
		await loadUsers();
	} catch (error) {
		showMessage(usersMessage, error.message || 'Unable to delete user', 'error');
	}
}

// ─── Event listeners ─────────────────────────────────────────────────────────

if (usersTableBody) {
	usersTableBody.addEventListener('click', function (event) {
		const editButton = event.target.closest('.edit-button');
		if (editButton) {
			openEditFormByIndex(Number(editButton.dataset.index));
			return;
		}

		const deleteButton = event.target.closest('.delete-button');
		if (deleteButton) handleDeleteUser(deleteButton.dataset.id);
	});
}

if (addUserForm) addUserForm.addEventListener('submit', handleAddUser);
if (editUserForm) editUserForm.addEventListener('submit', handleEditUser);
const cancelEdit = document.getElementById('cancelEdit');
const closeEditUserModal = document.getElementById('closeEditUserModal');
const openAddUserModalBtn = document.getElementById('openAddUserModal');
const closeAddUserModalBtn = document.getElementById('closeAddUserModal');
const cancelAddUser = document.getElementById('cancelAddUser');

if (cancelEdit) cancelEdit.addEventListener('click', closeEditForm);
if (closeEditUserModal) closeEditUserModal.addEventListener('click', closeEditForm);
if (openAddUserModalBtn) openAddUserModalBtn.addEventListener('click', openAddUserModal);
if (closeAddUserModalBtn) closeAddUserModalBtn.addEventListener('click', closeAddUserModal);
if (cancelAddUser) cancelAddUser.addEventListener('click', closeAddUserModal);
if (openSidebarBtn) openSidebarBtn.addEventListener('click', openNav);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeNav);

if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeNav);

document.addEventListener('keydown', function (event) {
	if (event.key === 'Escape') {
		if (typeof closeAddUserModal === 'function') closeAddUserModal();
		if (typeof closeEditForm === 'function') closeEditForm();
		closeNav();
	}
});

if (addUserModal) {
	addUserModal.addEventListener('click', function (event) {
		if (event.target === addUserModal) closeAddUserModal();
	});
}

if (editUserModal) {
	editUserModal.addEventListener('click', function (event) {
		if (event.target === editUserModal) closeEditForm();
	});
}

const passwordToggles = document.querySelectorAll('.eye-button');
passwordToggles.forEach(function (toggleButton) {
	toggleButton.addEventListener('click', function () {
		togglePasswordVisibility(toggleButton.dataset.target, toggleButton);
	});
});

loadUsers();
