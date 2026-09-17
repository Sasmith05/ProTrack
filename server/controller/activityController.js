const db = require('../db/connection');

exports.getLogs = async (req, res) => {
	let conn;
	try {
		const page = Math.max(1, parseInt(req.query.page) || 1);
		const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
		const offset = (page - 1) * limit;

		conn = await db.getConnection();

		const countRows = await conn.query('SELECT COUNT(*) AS total FROM activity_logs');
		const total = Number(countRows[0].total);

		const logs = await conn.query(
			`SELECT al.id, al.action, al.entity_type, al.entity_id, al.details,
				al.ip_address, al.created_at,
				CONCAT(u.first_name,' ',u.last_name) AS user_name, u.role AS user_role
			FROM activity_logs al
			JOIN users u ON u.id = al.user_id
			ORDER BY al.created_at DESC
			LIMIT ? OFFSET ?`,
			[limit, offset]
		);

		return res.status(200).json({
			success: true,
			logs: logs || [],
			pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
		});
	} catch (err) {
		console.error('getLogs error:', err);
		return res.status(500).json({ error: 'Unable to fetch activity logs' });
	} finally {
		if (conn) conn.release();
	}
};
