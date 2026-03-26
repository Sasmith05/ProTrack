let projects = [];

const projectsMessage = document.getElementById("projectsMessage");
const projectsTableBody = document.getElementById("projectsTableBody");
const addProjectForm = document.getElementById("addProjectForm");
const addProjectMessage = document.getElementById("addProjectMessage");
const editProjectCard = document.getElementById("editProjectCard");
const editProjectForm = document.getElementById("editProjectForm");
const editProjectMessage = document.getElementById("editProjectMessage");
const addProjectModal = document.getElementById("addProjectModal");

function openAddProjectModal() {
	showMessage(addProjectMessage, "");
	addProjectModal.classList.remove("hidden");
	addProjectModal.setAttribute("aria-hidden", "false");
}

function closeAddProjectModal() {
	addProjectForm.reset();
	showMessage(addProjectMessage, "");
	addProjectModal.classList.add("hidden");
	addProjectModal.setAttribute("aria-hidden", "true");
}

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

function formatDate(value) {
	if (!value) {
		return "";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toISOString().slice(0, 10);
}

function createCell(text) {
	const cell = document.createElement("td");
	cell.textContent = text || "";
	return cell;
}

function renderProjectsTable() {
	projectsTableBody.innerHTML = "";

	if (projects.length === 0) {
		showMessage(projectsMessage, "No projects found.");
		return;
	}

	showMessage(projectsMessage, "");

	for (let i = 0; i < projects.length; i += 1) {
		const project = projects[i];
		const row = document.createElement("tr");

		row.appendChild(createCell(project.project_name));
		row.appendChild(createCell(project.description));
		row.appendChild(createCell(formatDate(project.start_date)));
		row.appendChild(createCell(formatDate(project.end_date)));

		const actionCell = document.createElement("td");
		actionCell.className = "table-actions";

		const editButton = document.createElement("button");
		editButton.type = "button";
		editButton.className = "edit-button";
		editButton.innerText = "Edit";
		editButton.dataset.index = String(i);
		actionCell.appendChild(editButton);

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "delete-button";
		deleteButton.innerText = "Delete";
		deleteButton.dataset.id = String(project.id);
		actionCell.appendChild(deleteButton);

		row.appendChild(actionCell);
		projectsTableBody.appendChild(row);
	}
}

async function loadProjects() {
	try {
		const response = await fetch("/projects", {
			headers: { Accept: "application/json" }
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to load projects");
		}

		projects = data.projects || [];
		renderProjectsTable();
	} catch (error) {
		projects = [];
		projectsTableBody.innerHTML = "";
		showMessage(projectsMessage, error.message || "Unable to load projects", "error");
	}
}

function openEditFormByIndex(index) {
	const project = projects[index];

	if (!project) {
		return;
	}

	document.getElementById("editProjectId").value = project.id;
	document.getElementById("editProjectName").value = project.project_name || "";
	document.getElementById("editProjectDescription").value = project.description || "";
	document.getElementById("editProjectStartDate").value = formatDate(project.start_date);
	document.getElementById("editProjectEndDate").value = formatDate(project.end_date);

	showMessage(editProjectMessage, "");
	editProjectCard.classList.remove("hidden");
	editProjectCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditForm() {
	editProjectForm.reset();
	showMessage(editProjectMessage, "");
	editProjectCard.classList.add("hidden");
}

async function handleAddProject(event) {
	event.preventDefault();

	const payload = {
		projectName: document.getElementById("addProjectName").value.trim(),
		description: document.getElementById("addProjectDescription").value.trim(),
		startDate: document.getElementById("addProjectStartDate").value,
		endDate: document.getElementById("addProjectEndDate").value
	};

	if (!payload.projectName || !payload.description || !payload.startDate || !payload.endDate) {
		showMessage(addProjectMessage, "All fields are required.", "error");
		return;
	}

	if (payload.startDate > payload.endDate) {
		showMessage(addProjectMessage, "Start date cannot be after end date.", "error");
		return;
	}

	try {
		const response = await fetch("/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to add project");
		}

		addProjectForm.reset();
		showMessage(addProjectMessage, "Project added successfully.", "success");
		await loadProjects();
		closeAddProjectModal();
	} catch (error) {
		showMessage(addProjectMessage, error.message || "Unable to add project", "error");
	}
}

async function handleEditProject(event) {
	event.preventDefault();

	const projectId = document.getElementById("editProjectId").value.trim();
	const payload = {
		projectName: document.getElementById("editProjectName").value.trim(),
		description: document.getElementById("editProjectDescription").value.trim(),
		startDate: document.getElementById("editProjectStartDate").value,
		endDate: document.getElementById("editProjectEndDate").value
	};

	if (!projectId || !/^\d+$/.test(projectId)) {
		showMessage(editProjectMessage, "Invalid project selected for update.", "error");
		return;
	}

	if (!payload.projectName || !payload.description || !payload.startDate || !payload.endDate) {
		showMessage(editProjectMessage, "All fields are required.", "error");
		return;
	}

	if (payload.startDate > payload.endDate) {
		showMessage(editProjectMessage, "Start date cannot be after end date.", "error");
		return;
	}

	try {
		const updateUrl = new URL(`/projects/${encodeURIComponent(projectId)}`, window.location.origin);
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
			throw new Error(data.error || "Unable to update project");
		}

		showMessage(editProjectMessage, "Project updated successfully.", "success");
		await loadProjects();
	} catch (error) {
		showMessage(editProjectMessage, error.message || "Unable to update project", "error");
	}
}

async function handleDeleteProject(projectId) {
	if (!projectId || !/^\d+$/.test(projectId)) {
		showMessage(projectsMessage, "Invalid project selected for delete.", "error");
		return;
	}

	const shouldDelete = window.confirm("Delete this project?");

	if (!shouldDelete) {
		return;
	}

	try {
		const deleteUrl = new URL(`/projects/${encodeURIComponent(projectId)}`, window.location.origin);
		const response = await fetch(deleteUrl.toString(), {
			method: "DELETE",
			headers: { Accept: "application/json" }
		});
		const data = await getResponseData(response);

		if (!response.ok) {
			throw new Error(data.error || "Unable to delete project");
		}

		if (document.getElementById("editProjectId").value === projectId) {
			closeEditForm();
		}

		showMessage(projectsMessage, "Project deleted successfully.", "success");
		await loadProjects();
	} catch (error) {
		showMessage(projectsMessage, error.message || "Unable to delete project", "error");
	}
}

projectsTableBody.addEventListener("click", function (event) {
	const editButton = event.target.closest(".edit-button");
	if (editButton) {
		const index = Number(editButton.dataset.index);
		openEditFormByIndex(index);
		return;
	}

	const deleteButton = event.target.closest(".delete-button");
	if (deleteButton) {
		handleDeleteProject(deleteButton.dataset.id);
	}
});

addProjectForm.addEventListener("submit", handleAddProject);
editProjectForm.addEventListener("submit", handleEditProject);
document.getElementById("cancelProjectEdit").addEventListener("click", closeEditForm);
document.getElementById("openAddProjectModal").addEventListener("click", openAddProjectModal);
document.getElementById("closeAddProjectModal").addEventListener("click", closeAddProjectModal);
document.getElementById("cancelAddProject").addEventListener("click", closeAddProjectModal);

addProjectModal.addEventListener("click", function (event) {
	if (event.target === addProjectModal) {
		closeAddProjectModal();
	}
});

loadProjects();
