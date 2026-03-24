let users = [];

const usersMessage = document.getElementById("usersMessage");
const usersTableBody = document.getElementById("usersTableBody");
const addUserForm = document.getElementById("addUserForm");
const addUserMessage = document.getElementById("addUserMessage");
const editUserCard = document.getElementById("editUserCard");
const editUserForm = document.getElementById("editUserForm");
const editUserMessage = document.getElementById("editUserMessage");

function showMessage(element, text, type) {
	element.innerText = text || "";
	element.className = "status-text";

	if (type) {
		element.classList.add(type);
	}
}

async function getResponseData(response) {
	const text = await response.text();

	if (!text) {
		return {};
	}

	try {
		return JSON.parse(text);
	} catch (_err) {
		return { error: "Invalid server response" };
	}
}

function createCell(text) {
	const cell = document.createElement("td");
	cell.textContent = text || "";
	return cell;
}

function renderUsersTable() {
	usersTableBody.innerHTML = "";

	if (users.length === 0) {
		showMessage(usersMessage, "No users found.");
		return;
	}

	showMessage(usersMessage, "");

	for (let i = 0; i < users.length; i += 1) {
		const user = users[i];
		const row = document.createElement("tr");

		row.appendChild(createCell(user.first_name));
		row.appendChild(createCell(user.last_name));
		row.appendChild(createCell(user.phone));
		row.appendChild(createCell(user.email));

		const actionCell = document.createElement("td");
		const editButton = document.createElement("button");
		editButton.type = "button";
		editButton.className = "edit-button";
		editButton.innerText = "Edit";
		editButton.dataset.index = String(i);
		actionCell.appendChild(editButton);
		row.appendChild(actionCell);

		usersTableBody.appendChild(row);
	}
}

async function loadUsers() {
	try {
		const response = await fetch("/users", {
			headers: { Accept: "application/json" }
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to load users");
		}

		users = data.users || [];
		renderUsersTable();
	} catch (error) {
		users = [];
		usersTableBody.innerHTML = "";
		showMessage(usersMessage, error.message || "Unable to load users", "error");
	}
}

function openEditFormByIndex(index) {
	const user = users[index];

	if (!user) {
		return;
	}

	document.getElementById("editUserId").value = user.id;
	document.getElementById("editFirstName").value = user.first_name || "";
	document.getElementById("editLastName").value = user.last_name || "";
	document.getElementById("editPhone").value = user.phone || "";
	document.getElementById("editEmail").value = user.email || "";

	showMessage(editUserMessage, "");
	editUserCard.classList.remove("hidden");
	editUserCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditForm() {
	editUserForm.reset();
	showMessage(editUserMessage, "");
	editUserCard.classList.add("hidden");
}

function togglePasswordVisibility(targetId, toggleButton) {
	const input = document.getElementById(targetId);

	if (!input) {
		return;
	}

	if (input.type === "password") {
		input.type = "text";
		toggleButton.classList.add("active");
	} else {
		input.type = "password";
		toggleButton.classList.remove("active");
	}
}

async function handleAddUser(event) {
	event.preventDefault();

	const payload = {
		firstName: document.getElementById("addFirstName").value.trim(),
		lastName: document.getElementById("addLastName").value.trim(),
		phone: document.getElementById("addPhone").value.trim(),
		email: document.getElementById("addEmail").value.trim(),
		password: document.getElementById("addPassword").value
	};

	if (!payload.firstName || !payload.lastName || !payload.phone || !payload.email || !payload.password) {
		showMessage(addUserMessage, "All fields are required.", "error");
		return;
	}

	try {
		const response = await fetch("/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to add user");
		}

		addUserForm.reset();
		showMessage(addUserMessage, "User added successfully.", "success");
		await loadUsers();
	} catch (error) {
		showMessage(addUserMessage, error.message || "Unable to add user", "error");
	}
}

async function handleEditUser(event) {
	event.preventDefault();

	const userId = document.getElementById("editUserId").value.trim();
	const payload = {
		firstName: document.getElementById("editFirstName").value.trim(),
		lastName: document.getElementById("editLastName").value.trim(),
		phone: document.getElementById("editPhone").value.trim(),
		email: document.getElementById("editEmail").value.trim()
	};

	if (!userId || !/^\d+$/.test(userId)) {
		showMessage(editUserMessage, "Invalid user selected for update.", "error");
		return;
	}

	if (!payload.firstName || !payload.lastName || !payload.phone || !payload.email) {
		showMessage(editUserMessage, "All fields are required.", "error");
		return;
	}

	try {
		const updateUrl = new URL(`/users/${encodeURIComponent(userId)}`, window.location.origin);
		const response = await fetch(updateUrl.toString(), {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to update user");
		}

		showMessage(editUserMessage, "User updated successfully.", "success");
		await loadUsers();
	} catch (error) {
		const message = error && error.name === "TypeError"
			? "Cannot reach server while updating user. Check if the backend is running and reachable."
			: (error.message || "Unable to update user");

		showMessage(editUserMessage, message, "error");
	}
}

usersTableBody.addEventListener("click", function (event) {
	const button = event.target.closest(".edit-button");

	if (!button) {
		return;
	}

	const index = Number(button.dataset.index);
	openEditFormByIndex(index);
});

addUserForm.addEventListener("submit", handleAddUser);
editUserForm.addEventListener("submit", handleEditUser);
document.getElementById("cancelEdit").addEventListener("click", closeEditForm);

const passwordToggles = document.querySelectorAll(".eye-button");
passwordToggles.forEach(function (toggleButton) {
	toggleButton.addEventListener("click", function () {
		togglePasswordVisibility(toggleButton.dataset.target, toggleButton);
	});
});

loadUsers();
