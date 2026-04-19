const mariadb = require('mariadb');

const pool = mariadb.createPool({
host: "localhost",
user: "root",
password: "2609",
database: "nodeapp",
port: 3306
});

async function initializeUsersTable() {
	let conn;

	try {
		conn = await pool.getConnection();
		await conn.query(
			`CREATE TABLE IF NOT EXISTS users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				first_name VARCHAR(100) NOT NULL,
				last_name VARCHAR(100) NOT NULL,
				phone VARCHAR(20) NOT NULL,
				email VARCHAR(255) NOT NULL UNIQUE,
				password VARCHAR(255) NOT NULL,
				status VARCHAR(10) NOT NULL DEFAULT 'inactive'
			)`
		);

		const statusColumn = await conn.query("SHOW COLUMNS FROM users LIKE 'status'");

		if (!statusColumn.length) {
			await conn.query("ALTER TABLE users ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'inactive'");
		}

		await conn.query(
			"UPDATE users SET status='inactive' WHERE status IS NULL OR status NOT IN ('active', 'inactive')"
		);
	} catch (err) {
		console.error('Database init error (users table):', err);
	} finally {
		if (conn) {
			conn.release();
		}
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
				end_date DATE NOT NULL
			)`
		);
	} catch (err) {
		console.error('Database init error (projects table):', err);
	} finally {
		if (conn) {
			conn.release();
		}
	}
}

initializeProjectsTable();
initializeUsersTable();

module.exports = pool;