const db = require('../db/connection');

/**
 * getDashboard — renders the main analytics dashboard page.
 * Fetches all stats in parallel for performance.
 */
exports.getDashboard = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();

		// Run all stat queries in parallel
		const [
			userStats,
			projectStats,
			recentUsers,
			recentProjects,
			taskStats,
			recentActivity
		] = await Promise.all([
			conn.query(`
				SELECT
					COUNT(*) AS total,
					SUM(status = 'active') AS active,
					SUM(status = 'inactive') AS inactive
				FROM users
			`),
			conn.query(`
				SELECT
					COUNT(*) AS total,
					SUM(status = 'completed') AS completed,
					SUM(status = 'ongoing') AS ongoing,
					SUM(status = 'on_hold') AS on_hold
				FROM projects
			`),
			conn.query(`
				SELECT id, first_name, last_name, email, role, status
				FROM users
				ORDER BY id DESC
				LIMIT 5
			`),
			conn.query(`
				SELECT id, project_name, description, status, end_date
				FROM projects
				ORDER BY id DESC
				LIMIT 5
			`),
			conn.query(`
				SELECT
					COUNT(*) AS total,
					SUM(status = 'completed') AS completed,
					SUM(status = 'in_progress') AS in_progress,
					SUM(status = 'todo') AS todo,
					SUM(status = 'review') AS review,
					SUM(due_date < CURDATE() AND status != 'completed') AS overdue
				FROM tasks
			`).catch(() => [{ total: 0, completed: 0, in_progress: 0, todo: 0, review: 0, overdue: 0 }]),
			conn.query(`
				SELECT al.action, al.entity_type, al.created_at,
					CONCAT(u.first_name,' ',u.last_name) AS user_name
				FROM activity_logs al
				JOIN users u ON u.id = al.user_id
				ORDER BY al.created_at DESC
				LIMIT 8
			`).catch(() => [])
		]);

		const stats = {
			totalUsers: Number(userStats[0].total) || 0,
			activeUsers: Number(userStats[0].active) || 0,
			inactiveUsers: Number(userStats[0].inactive) || 0,
			totalProjects: Number(projectStats[0].total) || 0,
			completedProjects: Number(projectStats[0].completed) || 0,
			ongoingProjects: Number(projectStats[0].ongoing) || 0,
			onHoldProjects: Number(projectStats[0].on_hold) || 0,
			totalTasks: Number((taskStats[0] || {}).total) || 0,
			completedTasks: Number((taskStats[0] || {}).completed) || 0,
			inProgressTasks: Number((taskStats[0] || {}).in_progress) || 0,
			todoTasks: Number((taskStats[0] || {}).todo) || 0,
			overdueTasks: Number((taskStats[0] || {}).overdue) || 0
		};

		return res.render('dashboard', {
			stats,
			recentUsers,
			recentProjects,
			recentActivity: recentActivity || [],
			activePage: 'dashboard'
		});
	} catch (err) {
		console.error('getDashboard error:', err);
		return res.status(500).render('access-denied', {
			sessionUser: req.session.user,
			message: 'Unable to load dashboard statistics.'
		});
	} finally {
		if (conn) conn.release();
	}
};

/**
 * getStats — JSON endpoint consumed by dashboard.js charts.
 */
exports.getStats = async (req, res) => {
	let conn;

	try {
		conn = await db.getConnection();

		const [userStats, projectStats] = await Promise.all([
			conn.query(`
				SELECT
					SUM(status = 'active') AS active,
					SUM(status = 'inactive') AS inactive
				FROM users
			`),
			conn.query(`
				SELECT
					SUM(status = 'completed') AS completed,
					SUM(status = 'ongoing') AS ongoing,
					SUM(status = 'on_hold') AS on_hold
				FROM projects
			`)
		]);

		return res.status(200).json({
			success: true,
			users: {
				active: Number(userStats[0].active) || 0,
				inactive: Number(userStats[0].inactive) || 0
			},
			projects: {
				completed: Number(projectStats[0].completed) || 0,
				ongoing: Number(projectStats[0].ongoing) || 0,
				on_hold: Number(projectStats[0].on_hold) || 0
			}
		});
	} catch (err) {
		console.error('getStats error:', err);
		return res.status(500).json({ error: 'Unable to fetch stats' });
	} finally {
		if (conn) conn.release();
	}
};
