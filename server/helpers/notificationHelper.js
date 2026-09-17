/**
 * createNotification — inserts a notification row.
 * @param {object} conn       — active MariaDB connection
 * @param {number} userId     — recipient user id
 * @param {string} title
 * @param {string} message
 * @param {string} type       — 'success' | 'warning' | 'info' | 'error'
 * @param {string|null} relatedType
 * @param {number|null} relatedId
 */
async function createNotification(conn, userId, title, message, type, relatedType, relatedId) {
	try {
		await conn.query(
			`INSERT INTO notifications(user_id, title, message, type, related_type, related_id)
			VALUES (?, ?, ?, ?, ?, ?)`,
			[userId, String(title).slice(0, 255), String(message), type || 'info', relatedType || null, relatedId || null]
		);
	} catch (err) {
		console.error('createNotification error:', err);
	}
}

module.exports = { createNotification };
