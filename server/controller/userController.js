const db = require('../db/connection');

function isStrongPassword(password = '') {
	const hasMinLength = password.length >= 8;
	const hasUppercase = /[A-Z]/.test(password);
	const hasLowercase = /[a-z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const hasSymbol = /[^A-Za-z0-9]/.test(password);

	return hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol;
}

function hasRequiredFields(values) {
	for (let i = 0; i < values.length; i += 1) {
		if (!values[i]) {
			return false;
		}
	}

	return true;
}

async function emailExists(conn, email, currentUserId) {
	if (currentUserId) {
		const rows = await conn.query(
			'SELECT id FROM users WHERE email=? AND id<>? LIMIT 1',
			[email, currentUserId]
		);

		return rows.length > 0;
	}

	const rows = await conn.query(
		'SELECT id FROM users WHERE email=? LIMIT 1',
		[email]
	);

	return rows.length > 0;
}

async function createUser(conn, firstName, lastName, phone, email, password) {
	await conn.query(
		'INSERT INTO users(first_name,last_name,phone,email,password) VALUES (?,?,?,?,?)',
		[firstName, lastName, phone, email, password]
	);
}

exports.registerUser = async (req, res) => {
	let conn;

	try {
		const { firstName, lastName, phone, email, password } = req.body || {};

		if (!hasRequiredFields([firstName, lastName, phone, email, password])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (!isStrongPassword(password)) {
			return res.status(400).json({
				error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol'
			});
		}

		conn = await db.getConnection();

		if (await emailExists(conn, email)) {
			return res.status(409).json({ error: 'Email already exists' });
		}

		await createUser(conn, firstName, lastName, phone, email, password);

		return res.status(201).json({ success: true, message: 'Registration successful' });
	} catch (err) {
		console.error('registerUser error:', err);
		return res.status(500).json({ error: 'Database error' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.loginUser = async (req, res) => {
	let conn;

	try {
		const { email, password } = req.body || {};

		if (!hasRequiredFields([email, password])) {
			return res.status(400).json({ error: 'Email and password are required' });
		}

		conn = await db.getConnection();

		const rows = await conn.query(
			'SELECT first_name, password FROM users WHERE email=? LIMIT 1',
			[email]
		);

		if (!rows.length || rows[0].password !== password) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}

		return res.status(200).json({
			success: true,
			name: rows[0].first_name || 'User',
			redirectTo: '/users-page'
		});
	} catch (err) {
		console.error('loginUser error:', err);
		return res.status(500).json({ error: 'Database error' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

function toDbDate(value) {
	if (!value) {
		return null;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	return value;
}

exports.getProjects = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();

		const projects = await conn.query(
			'SELECT id, project_name, description, start_date, end_date FROM projects ORDER BY id DESC'
		);

		return res.status(200).json({ success: true, projects: projects || [] });
	} catch (err) {
		console.error('getProjects error:', err);
		return res.status(500).json({ error: 'Unable to fetch projects' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.addProject = async (req, res) => {
	let conn;

	try {
		const { projectName, description, startDate, endDate } = req.body || {};
		const startDateValue = toDbDate(startDate);
		const endDateValue = toDbDate(endDate);

		if (!hasRequiredFields([projectName, description, startDateValue, endDateValue])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (startDateValue > endDateValue) {
			return res.status(400).json({ error: 'Start date cannot be after end date' });
		}

		conn = await db.getConnection();

		await conn.query(
			'INSERT INTO projects(project_name, description, start_date, end_date) VALUES (?,?,?,?)',
			[projectName, description, startDateValue, endDateValue]
		);

		return res.status(201).json({ success: true, message: 'Project added successfully' });
	} catch (err) {
		console.error('addProject error:', err);
		return res.status(500).json({ error: 'Unable to add project' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.updateProject = async (req, res) => {
	let conn;

	try {
		const projectId = Number(req.params.id);
		const { projectName, description, startDate, endDate } = req.body || {};
		const startDateValue = toDbDate(startDate);
		const endDateValue = toDbDate(endDate);

		if (!Number.isInteger(projectId) || projectId <= 0) {
			return res.status(400).json({ error: 'Invalid project id' });
		}

		if (!hasRequiredFields([projectName, description, startDateValue, endDateValue])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (startDateValue > endDateValue) {
			return res.status(400).json({ error: 'Start date cannot be after end date' });
		}

		conn = await db.getConnection();

		const existingProject = await conn.query(
			'SELECT id FROM projects WHERE id=? LIMIT 1',
			[projectId]
		);

		if (!existingProject.length) {
			return res.status(404).json({ error: 'Project not found' });
		}

		await conn.query(
			'UPDATE projects SET project_name=?, description=?, start_date=?, end_date=? WHERE id=?',
			[projectName, description, startDateValue, endDateValue, projectId]
		);

		return res.status(200).json({ success: true, message: 'Project updated successfully' });
	} catch (err) {
		console.error('updateProject error:', err);
		return res.status(500).json({ error: 'Unable to update project' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.deleteProject = async (req, res) => {
	let conn;

	try {
		const projectId = Number(req.params.id);

		if (!Number.isInteger(projectId) || projectId <= 0) {
			return res.status(400).json({ error: 'Invalid project id' });
		}

		conn = await db.getConnection();

		const result = await conn.query('DELETE FROM projects WHERE id=?', [projectId]);

		if (!result.affectedRows) {
			return res.status(404).json({ error: 'Project not found' });
		}

		return res.status(200).json({ success: true, message: 'Project deleted successfully' });
	} catch (err) {
		console.error('deleteProject error:', err);
		return res.status(500).json({ error: 'Unable to delete project' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.getUsers = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();

		const users = await conn.query(
			'SELECT id, first_name, last_name, phone, email FROM users ORDER BY id DESC'
		);

		return res.status(200).json({ success: true, users: users || [] });
	} catch (err) {
		console.error('getUsers error:', err);
		return res.status(500).json({ error: 'Unable to fetch users' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.addUser = async (req, res) => {
	let conn;

	try {
		const { firstName, lastName, phone, email, password } = req.body || {};

		if (!hasRequiredFields([firstName, lastName, phone, email, password])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (!isStrongPassword(password)) {
			return res.status(400).json({
				error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol'
			});
		}

		conn = await db.getConnection();

		if (await emailExists(conn, email)) {
			return res.status(409).json({ error: 'Email already exists' });
		}

		await createUser(conn, firstName, lastName, phone, email, password);

		return res.status(201).json({ success: true, message: 'User added successfully' });
	} catch (err) {
		console.error('addUser error:', err);
		return res.status(500).json({ error: 'Unable to add user' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.updateUser = async (req, res) => {
	let conn;

	try {
		const userId = Number(req.params.id);
		const { firstName, lastName, phone, email } = req.body || {};

		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(400).json({ error: 'Invalid user id' });
		}

		if (!hasRequiredFields([firstName, lastName, phone, email])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		conn = await db.getConnection();

		const existingUser = await conn.query(
			'SELECT id FROM users WHERE id=? LIMIT 1',
			[userId]
		);

		if (!existingUser.length) {
			return res.status(404).json({ error: 'User not found' });
		}

		if (await emailExists(conn, email, userId)) {
			return res.status(409).json({ error: 'Email already exists' });
		}

		await conn.query(
			'UPDATE users SET first_name=?, last_name=?, phone=?, email=? WHERE id=?',
			[firstName, lastName, phone, email, userId]
		);

		return res.status(200).json({ success: true, message: 'User updated successfully' });
	} catch (err) {
		console.error('updateUser error:', err);
		return res.status(500).json({ error: 'Unable to update user' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};

exports.deleteUser = async (req, res) => {
	let conn;

	try {
		const userId = Number(req.params.id);

		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(400).json({ error: 'Invalid user id' });
		}

		conn = await db.getConnection();

		const result = await conn.query('DELETE FROM users WHERE id=?', [userId]);

		if (!result.affectedRows) {
			return res.status(404).json({ error: 'User not found' });
		}

		return res.status(200).json({ success: true, message: 'User deleted successfully' });
	} catch (err) {
		console.error('deleteUser error:', err);
		return res.status(500).json({ error: 'Unable to delete user' });
	} finally {
		if (conn) {
			conn.release();
		}
	}
};