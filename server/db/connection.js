const mariadb = require('mariadb');

const pool = mariadb.createPool({
host: "localhost",
user: "root",
password: "2609",
database: "nodeapp",
port: 3306
});

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

module.exports = pool;