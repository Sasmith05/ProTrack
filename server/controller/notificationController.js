const db = require('../db/connection');

exports.getNotifications = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const notifications = await conn.query(
			`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30`,
			[req.session.user.id]
		);
		const unreadCount = notifications.filter(n => !n.is_read).length;
		return res.status(200).json({ success: true, notifications: notifications || [], unreadCount });
	} catch (err) {
		console.error('getNotifications error:', err);
		return res.status(500).json({ error: 'Unable to fetch notifications' });
	} finally {
		if (conn) conn.release();
	}
};

exports.markRead = async (req, res) => {
	let conn;
	try {
		const notifId = Number(req.params.id);
		if (!Number.isInteger(notifId) || notifId <= 0) return res.status(400).json({ error: 'Invalid notification id' });

		conn = await db.getConnection();
		await conn.query(
			'UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',
			[notifId, req.session.user.id]
		);
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('markRead error:', err);
		return res.status(500).json({ error: 'Unable to mark notification as read' });
	} finally {
		if (conn) conn.release();
	}
};

exports.markAllRead = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		await conn.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.session.user.id]);
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('markAllRead error:', err);
		return res.status(500).json({ error: 'Unable to mark all as read' });
	} finally {
		if (conn) conn.release();
	}
};
