const db = require('../db/connection');

exports.globalSearch = async (req, res) => {
	let conn;
	try {
		const q = (req.query.q || '').trim();
		if (!q || q.length < 2) return res.status(200).json({ success: true, results: { users: [], projects: [], tasks: [] } });

		const like = `%${q}%`;
		conn = await db.getConnection();

		const isAdmin = ['super_admin', 'admin'].includes(req.session.user.role);
		const userId = req.session.user.id;

		const [users, projects, tasks] = await Promise.all([
			// Users — only admins can search users
			isAdmin
				? conn.query(
					`SELECT id, first_name, last_name, email, role, status
					FROM users WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? LIMIT 5`,
					[like, like, like]
				)
				: Promise.resolve([]),

			// Projects — all roles
			conn.query(
				`SELECT id, project_name, status FROM projects WHERE project_name LIKE ? OR description LIKE ? LIMIT 5`,
				[like, like]
			),

			// Tasks — employees see only their own
			req.session.user.role === 'employee'
				? conn.query(
					`SELECT t.id, t.title, t.status, t.priority, p.project_name
					FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
					WHERE t.assigned_to=? AND (t.title LIKE ? OR t.description LIKE ?) LIMIT 5`,
					[userId, like, like]
				)
				: conn.query(
					`SELECT t.id, t.title, t.status, t.priority, p.project_name
					FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
					WHERE t.title LIKE ? OR t.description LIKE ? LIMIT 5`,
					[like, like]
				)
		]);

		return res.status(200).json({ success: true, results: { users, projects, tasks } });
	} catch (err) {
		console.error('globalSearch error:', err);
		return res.status(500).json({ error: 'Search failed' });
	} finally {
		if (conn) conn.release();
	}
};
