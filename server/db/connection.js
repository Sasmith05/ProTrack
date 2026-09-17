const mariadb = require('mariadb');

const pool = mariadb.createPool({
	host: 'localhost',
	user: 'root',
	password: '2609',
	database: 'nodeapp',
	port: 3306
});

async function initializeUsersTable() {
	let conn;

	try {
		conn = await pool.getConnection();

		// Create users table if not exists
		await conn.query(
			`CREATE TABLE IF NOT EXISTS users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				first_name VARCHAR(100) NOT NULL,
				last_name VARCHAR(100) NOT NULL,
				phone VARCHAR(20) NOT NULL,
				email VARCHAR(255) NOT NULL UNIQUE,
				password VARCHAR(255) NOT NULL,
				status VARCHAR(10) NOT NULL DEFAULT 'inactive',
				role VARCHAR(20) NOT NULL DEFAULT 'admin'
			)`
		);

		// Ensure status column exists (migration for older schemas)
		const statusColumn = await conn.query("SHOW COLUMNS FROM users LIKE 'status'");
		if (!statusColumn.length) {
			await conn.query(
				"ALTER TABLE users ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'inactive'"
			);
		}

		// Ensure role column exists (Phase 1 migration)
		const roleColumn = await conn.query("SHOW COLUMNS FROM users LIKE 'role'");
		if (!roleColumn.length) {
			await conn.query(
				"ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin'"
			);
		}

		// Sanitize any stale status values
		await conn.query(
			"UPDATE users SET status='inactive' WHERE status IS NULL OR status NOT IN ('active', 'inactive')"
		);

		// Sanitize any stale role values
		await conn.query(
			"UPDATE users SET role='admin' WHERE role IS NULL OR role NOT IN ('super_admin', 'admin', 'project_manager', 'employee')"
		);
	} catch (err) {
		console.error('Database init error (users table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeProjectsTable() {
	let conn;

	try {
		conn = await pool.getConnection();

		await conn.query(
			`CREATE TABLE IF NOT EXISTS projects (
				id INT AUTO_INCREMENT PRIMARY KEY,
				project_name VARCHAR(255) NOT NULL,
				description TEXT NOT NULL,
				start_date DATE NOT NULL,
				end_date DATE NOT NULL,
				status VARCHAR(20) NOT NULL DEFAULT 'ongoing'
			)`
		);

		// Ensure status column exists on projects (Phase 1 migration)
		const statusCol = await conn.query("SHOW COLUMNS FROM projects LIKE 'status'");
		if (!statusCol.length) {
			await conn.query(
				"ALTER TABLE projects ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ongoing'"
			);
		}

		// Sanitize project status values
		await conn.query(
			"UPDATE projects SET status='ongoing' WHERE status IS NULL OR status NOT IN ('ongoing', 'completed', 'on_hold')"
		);
	} catch (err) {
		console.error('Database init error (projects table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeEmployeeProfilesTable() {
	let conn;

	try {
		conn = await pool.getConnection();

		await conn.query(
			`CREATE TABLE IF NOT EXISTS employee_profiles (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL UNIQUE,
				designation VARCHAR(100) DEFAULT NULL,
				department VARCHAR(100) DEFAULT NULL,
				skills TEXT DEFAULT NULL,
				experience VARCHAR(100) DEFAULT NULL,
				joining_date DATE DEFAULT NULL,
				address TEXT DEFAULT NULL,
				bio TEXT DEFAULT NULL,
				avatar VARCHAR(255) DEFAULT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)`
		);
	} catch (err) {
		console.error('Database init error (employee_profiles table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeTasksTable() {
	let conn;
	try {
		conn = await pool.getConnection();
		await conn.query(`
			CREATE TABLE IF NOT EXISTS tasks (
				id INT AUTO_INCREMENT PRIMARY KEY,
				project_id INT NOT NULL,
				assigned_to INT DEFAULT NULL,
				title VARCHAR(500) NOT NULL,
				description TEXT DEFAULT NULL,
				priority VARCHAR(20) NOT NULL DEFAULT 'medium',
				status VARCHAR(20) NOT NULL DEFAULT 'todo',
				estimated_hours DECIMAL(6,2) DEFAULT NULL,
				actual_hours DECIMAL(6,2) DEFAULT NULL,
				start_date DATE DEFAULT NULL,
				due_date DATE DEFAULT NULL,
				completed_date DATE DEFAULT NULL,
				created_by INT NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
				FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
				FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
			)
		`);
	} catch (err) {
		console.error('Database init error (tasks table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeTaskAttachmentsTable() {
	let conn;
	try {
		conn = await pool.getConnection();
		await conn.query(`
			CREATE TABLE IF NOT EXISTS task_attachments (
				id INT AUTO_INCREMENT PRIMARY KEY,
				task_id INT NOT NULL,
				filename VARCHAR(255) NOT NULL,
				original_name VARCHAR(500) NOT NULL,
				file_path VARCHAR(500) NOT NULL,
				file_size BIGINT NOT NULL,
				mime_type VARCHAR(100) NOT NULL,
				uploaded_by INT NOT NULL,
				uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
				FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
			)
		`);
	} catch (err) {
		console.error('Database init error (task_attachments table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeTaskCommentsTable() {
	let conn;
	try {
		conn = await pool.getConnection();
		await conn.query(`
			CREATE TABLE IF NOT EXISTS task_comments (
				id INT AUTO_INCREMENT PRIMARY KEY,
				task_id INT NOT NULL,
				user_id INT NOT NULL,
				content TEXT NOT NULL,
				is_edited TINYINT(1) NOT NULL DEFAULT 0,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);
	} catch (err) {
		console.error('Database init error (task_comments table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeNotificationsTable() {
	let conn;
	try {
		conn = await pool.getConnection();
		await conn.query(`
			CREATE TABLE IF NOT EXISTS notifications (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				title VARCHAR(255) NOT NULL,
				message TEXT NOT NULL,
				type VARCHAR(20) NOT NULL DEFAULT 'info',
				is_read TINYINT(1) NOT NULL DEFAULT 0,
				related_type VARCHAR(50) DEFAULT NULL,
				related_id INT DEFAULT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);
	} catch (err) {
		console.error('Database init error (notifications table):', err);
	} finally {
		if (conn) conn.release();
	}
}

async function initializeActivityLogsTable() {
	let conn;
	try {
		conn = await pool.getConnection();
		await conn.query(`
			CREATE TABLE IF NOT EXISTS activity_logs (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				action VARCHAR(255) NOT NULL,
				entity_type VARCHAR(50) DEFAULT NULL,
				entity_id INT DEFAULT NULL,
				details TEXT DEFAULT NULL,
				ip_address VARCHAR(45) DEFAULT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);
	} catch (err) {
		console.error('Database init error (activity_logs table):', err);
	} finally {
		if (conn) conn.release();
	}
}

// Run all migrations on startup — must be sequential to respect FK dependencies
(async () => {
	await initializeUsersTable();
	await initializeProjectsTable();
	await initializeEmployeeProfilesTable();
	await initializeTasksTable();          // tasks must exist before task_attachments/comments
	await initializeTaskAttachmentsTable();
	await initializeTaskCommentsTable();
	await initializeNotificationsTable();
	await initializeActivityLogsTable();
})();

module.exports = pool;