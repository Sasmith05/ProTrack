const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { UserStatus, normalizeUserStatus } = require('../enums/userStatusEnum');
const { UserRole, normalizeUserRole } = require('../enums/userRoleEnum');

const BCRYPT_ROUNDS = 12;

// ─── Helpers ────────────────────────────────────────────────────────────────

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
		if (!values[i]) return false;
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

async function createUser(conn, firstName, lastName, phone, email, hashedPassword, status, role) {
	await conn.query(
		'INSERT INTO users(first_name,last_name,phone,email,password,status,role) VALUES (?,?,?,?,?,?,?)',
		[firstName, lastName, phone, email, hashedPassword, status, role]
	);
}

/**
 * Returns true if the string looks like a bcrypt hash.
 * Used for lazy-rehash of existing plaintext passwords.
 */
function isBcryptHash(str) {
	return typeof str === 'string' && str.startsWith('$2');
}

function toDbDate(value) {
	if (!value) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	return value;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

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

		// Determine role: first user in the system becomes super_admin
		const countRows = await conn.query('SELECT COUNT(*) AS total FROM users');
		const isFirstUser = Number(countRows[0].total) === 0;
		const role = isFirstUser ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE;

		const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

		await createUser(
			conn,
			firstName,
			lastName,
			phone,
			email,
			hashedPassword,
			isFirstUser ? UserStatus.ACTIVE : UserStatus.INACTIVE,
			role
		);

		return res.status(201).json({ success: true, message: 'Registration successful' });
	} catch (err) {
		console.error('registerUser error:', err);
		return res.status(500).json({ error: 'Database error' });
	} finally {
		if (conn) conn.release();
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
			'SELECT id, first_name, password, role, status FROM users WHERE email=? LIMIT 1',
			[email]
		);

		if (!rows.length) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}

		const user = rows[0];
		let passwordValid = false;

		if (isBcryptHash(user.password)) {
			// Normal bcrypt comparison
			passwordValid = await bcrypt.compare(password, user.password);
		} else {
			// Lazy rehash: legacy plaintext password
			passwordValid = password === user.password;

			if (passwordValid) {
				// Upgrade to bcrypt on first successful login
				const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
				await conn.query('UPDATE users SET password=? WHERE id=?', [newHash, user.id]);
			}
		}

		if (!passwordValid) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}

		if (user.status !== UserStatus.ACTIVE) {
			return res.status(403).json({ error: 'Your account is inactive. Please contact an administrator.' });
		}

		// Write session — only store safe fields, never the password
		req.session.user = {
			id: Number(user.id),
			name: user.first_name,
			role: user.role
		};

		return res.status(200).json({
			success: true,
			redirectTo: '/dashboard'
		});
	} catch (err) {
		console.error('loginUser error:', err);
		return res.status(500).json({ error: 'Database error' });
	} finally {
		if (conn) conn.release();
	}
};

exports.logoutUser = (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error('Logout error:', err);
		}
		res.clearCookie('connect.sid');
		res.redirect('/login');
	});
};

// ─── Users CRUD ──────────────────────────────────────────────────────────────

exports.getUsers = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();
		const users = await conn.query(
			'SELECT id, first_name, last_name, phone, email, status, role FROM users ORDER BY id DESC'
		);
		return res.status(200).json({ success: true, users: users || [] });
	} catch (err) {
		console.error('getUsers error:', err);
		return res.status(500).json({ error: 'Unable to fetch users' });
	} finally {
		if (conn) conn.release();
	}
};

exports.addUser = async (req, res) => {
	let conn;

	try {
		const { firstName, lastName, phone, email, password, status, role } = req.body || {};
		const normalizedStatus = normalizeUserStatus(status);
		const normalizedRole = normalizeUserRole(role);

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

		const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
		await createUser(conn, firstName, lastName, phone, email, hashedPassword, normalizedStatus, normalizedRole);

		return res.status(201).json({ success: true, message: 'User added successfully' });
	} catch (err) {
		console.error('addUser error:', err);
		return res.status(500).json({ error: 'Unable to add user' });
	} finally {
		if (conn) conn.release();
	}
};

exports.updateUser = async (req, res) => {
	let conn;

	try {
		const userId = Number(req.params.id);
		const { firstName, lastName, phone, email, status, role } = req.body || {};
		const normalizedStatus = normalizeUserStatus(status);
		const normalizedRole = normalizeUserRole(role);

		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(400).json({ error: 'Invalid user id' });
		}

		if (!hasRequiredFields([firstName, lastName, phone, email])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		conn = await db.getConnection();

		const existingUser = await conn.query('SELECT id, role FROM users WHERE id=? LIMIT 1', [userId]);

		if (!existingUser.length) {
			return res.status(404).json({ error: 'User not found' });
		}

		// Prevent non-super_admin from changing a super_admin's role
		const requestingRole = req.session.user && req.session.user.role;
		if (
			existingUser[0].role === 'super_admin' &&
			requestingRole !== 'super_admin'
		) {
			return res.status(403).json({ error: 'Cannot modify a Super Admin account' });
		}

		if (await emailExists(conn, email, userId)) {
			return res.status(409).json({ error: 'Email already exists' });
		}

		await conn.query(
			'UPDATE users SET first_name=?, last_name=?, phone=?, email=?, status=?, role=? WHERE id=?',
			[firstName, lastName, phone, email, normalizedStatus, normalizedRole, userId]
		);

		return res.status(200).json({ success: true, message: 'User updated successfully' });
	} catch (err) {
		console.error('updateUser error:', err);
		return res.status(500).json({ error: 'Unable to update user' });
	} finally {
		if (conn) conn.release();
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

		const target = await conn.query('SELECT id, role FROM users WHERE id=? LIMIT 1', [userId]);

		if (!target.length) {
			return res.status(404).json({ error: 'User not found' });
		}

		// Only super_admin can delete another super_admin
		const requestingRole = req.session.user && req.session.user.role;
		if (target[0].role === 'super_admin' && requestingRole !== 'super_admin') {
			return res.status(403).json({ error: 'Cannot delete a Super Admin account' });
		}

		const result = await conn.query('DELETE FROM users WHERE id=?', [userId]);

		if (!result.affectedRows) {
			return res.status(404).json({ error: 'User not found' });
		}

		return res.status(200).json({ success: true, message: 'User deleted successfully' });
	} catch (err) {
		console.error('deleteUser error:', err);
		return res.status(500).json({ error: 'Unable to delete user' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── Projects CRUD ───────────────────────────────────────────────────────────

exports.getProjects = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();
		const projects = await conn.query(
			'SELECT id, project_name, description, start_date, end_date, status FROM projects ORDER BY id DESC'
		);
		return res.status(200).json({ success: true, projects: projects || [] });
	} catch (err) {
		console.error('getProjects error:', err);
		return res.status(500).json({ error: 'Unable to fetch projects' });
	} finally {
		if (conn) conn.release();
	}
};

exports.addProject = async (req, res) => {
	let conn;

	try {
		const { projectName, description, startDate, endDate, status } = req.body || {};
		const startDateValue = toDbDate(startDate);
		const endDateValue = toDbDate(endDate);
		const projectStatus = ['ongoing', 'completed', 'on_hold'].includes(status) ? status : 'ongoing';

		if (!hasRequiredFields([projectName, description, startDateValue, endDateValue])) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		if (startDateValue > endDateValue) {
			return res.status(400).json({ error: 'Start date cannot be after end date' });
		}

		conn = await db.getConnection();

		await conn.query(
			'INSERT INTO projects(project_name, description, start_date, end_date, status) VALUES (?,?,?,?,?)',
			[projectName, description, startDateValue, endDateValue, projectStatus]
		);

		return res.status(201).json({ success: true, message: 'Project added successfully' });
	} catch (err) {
		console.error('addProject error:', err);
		return res.status(500).json({ error: 'Unable to add project' });
	} finally {
		if (conn) conn.release();
	}
};

exports.updateProject = async (req, res) => {
	let conn;

	try {
		const projectId = Number(req.params.id);
		const { projectName, description, startDate, endDate, status } = req.body || {};
		const startDateValue = toDbDate(startDate);
		const endDateValue = toDbDate(endDate);
		const projectStatus = ['ongoing', 'completed', 'on_hold'].includes(status) ? status : 'ongoing';

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
			'UPDATE projects SET project_name=?, description=?, start_date=?, end_date=?, status=? WHERE id=?',
			[projectName, description, startDateValue, endDateValue, projectStatus, projectId]
		);

		return res.status(200).json({ success: true, message: 'Project updated successfully' });
	} catch (err) {
		console.error('updateProject error:', err);
		return res.status(500).json({ error: 'Unable to update project' });
	} finally {
		if (conn) conn.release();
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
		if (conn) conn.release();
	}
};