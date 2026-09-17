/**
 * logActivity — inserts a record into activity_logs.
 * @param {object} conn  — active MariaDB connection (will NOT be released here)
 * @param {number} userId
 * @param {string} action
 * @param {string} entityType  — e.g. 'task', 'project', 'user'
 * @param {number|null} entityId
 * @param {string|null} details
 * @param {string|null} ip
 */
async function logActivity(conn, userId, action, entityType, entityId, details, ip) {
	try {
		await conn.query(
			`INSERT INTO activity_logs(user_id, action, entity_type, entity_id, details, ip_address)
			VALUES (?, ?, ?, ?, ?, ?)`,
			[userId, String(action).slice(0, 255), entityType || null, entityId || null, details || null, ip || null]
		);
	} catch (err) {
		// Never let logging errors crash the main request
		console.error('logActivity error:', err);
	}
}

module.exports = { logActivity };
