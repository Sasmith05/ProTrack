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
			redirectTo: '/dashboard'
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