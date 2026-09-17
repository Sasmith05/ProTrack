const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/connection');
const { TASK_STATUS_VALUES, normalizeTaskStatus } = require('../enums/taskStatusEnum');
const { TASK_PRIORITY_VALUES, normalizeTaskPriority } = require('../enums/taskPriorityEnum');
const { logActivity } = require('../helpers/activityLogger');
const { createNotification } = require('../helpers/notificationHelper');

// ─── Multer setup for task attachments ───────────────────────────────────────

const ALLOWED_MIME = [
	'image/jpeg', 'image/png', 'image/gif', 'image/webp',
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/zip', 'application/x-zip-compressed'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
	destination: function (req, _file, cb) {
		const taskDir = path.join(__dirname, '../../public/uploads/tasks', String(req.params.id || 'temp'));
		if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
		cb(null, taskDir);
	},
	filename: function (_req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase();
		cb(null, `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
	}
});

const fileFilter = function (_req, file, cb) {
	if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
	else cb(new Error('File type not allowed. Supported: images, PDF, Word, Excel, ZIP.'), false);
};

exports.uploadAttachmentMiddleware = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter }).single('attachment');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDbDate(value) {
	if (!value) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	return value;
}

function canManageTasks(role) {
	return ['super_admin', 'admin', 'project_manager'].includes(role);
}

// ─── getTasks ─────────────────────────────────────────────────────────────────

exports.getTasks = async (req, res) => {
	let conn;
	try {
		const { project_id, assigned_to, status, priority, q, sort, page = 1, limit = 50 } = req.query;
		const where = [];
		const params = [];

		if (project_id && /^\d+$/.test(project_id)) { where.push('t.project_id = ?'); params.push(Number(project_id)); }
		if (assigned_to && /^\d+$/.test(assigned_to)) { where.push('t.assigned_to = ?'); params.push(Number(assigned_to)); }
		if (status && TASK_STATUS_VALUES.includes(status)) { where.push('t.status = ?'); params.push(status); }
		if (priority && TASK_PRIORITY_VALUES.includes(priority)) { where.push('t.priority = ?'); params.push(priority); }
		if (q && q.trim()) {
			where.push('(t.title LIKE ? OR t.description LIKE ?)');
			params.push(`%${q.trim()}%`, `%${q.trim()}%`);
		}
		// Employees see only their own tasks
		if (req.session.user.role === 'employee') {
			where.push('t.assigned_to = ?');
			params.push(req.session.user.id);
		}

		const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
		const sortMap = {
			due_asc: 't.due_date ASC',
			due_desc: 't.due_date DESC',
			created_desc: 't.created_at DESC',
			created_asc: 't.created_at ASC',
			priority_desc: "FIELD(t.priority,'critical','high','medium','low')",
			priority_asc: "FIELD(t.priority,'low','medium','high','critical')"
		};
		const orderBy = sortMap[sort] || 't.created_at DESC';
		const pageNum = Math.max(1, parseInt(page) || 1);
		const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
		const offset = (pageNum - 1) * limitNum;

		conn = await db.getConnection();

		const countRows = await conn.query(`SELECT COUNT(*) AS total FROM tasks t ${whereClause}`, params);
		const total = Number(countRows[0].total);

		const tasks = await conn.query(
			`SELECT t.id, t.title, t.description, t.priority, t.status,
				t.estimated_hours, t.actual_hours, t.start_date, t.due_date,
				t.completed_date, t.created_at, t.updated_at, t.project_id, t.assigned_to,
				p.project_name,
				CONCAT(u.first_name, ' ', u.last_name) AS assigned_name,
				CONCAT(cb.first_name, ' ', cb.last_name) AS created_by_name
			FROM tasks t
			LEFT JOIN projects p ON p.id = t.project_id
			LEFT JOIN users u ON u.id = t.assigned_to
			LEFT JOIN users cb ON cb.id = t.created_by
			${whereClause}
			ORDER BY ${orderBy}
			LIMIT ? OFFSET ?`,
			[...params, limitNum, offset]
		);

		return res.status(200).json({
			success: true,
			tasks: tasks || [],
			pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
		});
	} catch (err) {
		console.error('getTasks error:', err);
		return res.status(500).json({ error: 'Unable to fetch tasks' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── getTask (single, with comments + attachments) ────────────────────────────

exports.getTask = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

		conn = await db.getConnection();
		const tasks = await conn.query(
			`SELECT t.*, p.project_name,
				CONCAT(u.first_name,' ',u.last_name) AS assigned_name,
				CONCAT(cb.first_name,' ',cb.last_name) AS created_by_name
			FROM tasks t
			LEFT JOIN projects p ON p.id = t.project_id
			LEFT JOIN users u ON u.id = t.assigned_to
			LEFT JOIN users cb ON cb.id = t.created_by
			WHERE t.id = ? LIMIT 1`,
			[taskId]
		);
		if (!tasks.length) return res.status(404).json({ error: 'Task not found' });

		const comments = await conn.query(
			`SELECT tc.*, CONCAT(u.first_name,' ',u.last_name) AS author_name
			FROM task_comments tc
			JOIN users u ON u.id = tc.user_id
			WHERE tc.task_id = ? ORDER BY tc.created_at DESC`,
			[taskId]
		);

		const attachments = await conn.query(
			`SELECT ta.*, CONCAT(u.first_name,' ',u.last_name) AS uploader_name
			FROM task_attachments ta
			JOIN users u ON u.id = ta.uploaded_by
			WHERE ta.task_id = ? ORDER BY ta.uploaded_at DESC`,
			[taskId]
		);

		return res.status(200).json({ success: true, task: tasks[0], comments: comments || [], attachments: attachments || [] });
	} catch (err) {
		console.error('getTask error:', err);
		return res.status(500).json({ error: 'Unable to fetch task' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── addTask ─────────────────────────────────────────────────────────────────

exports.addTask = async (req, res) => {
	let conn;
	try {
		const { projectId, assignedTo, title, description, priority, status, estimatedHours, startDate, dueDate } = req.body || {};

		if (!title || !String(title).trim()) return res.status(400).json({ error: 'Task title is required' });
		if (!projectId || !/^\d+$/.test(String(projectId))) return res.status(400).json({ error: 'Valid project is required' });

		const normStatus = normalizeTaskStatus(status);
		const normPriority = normalizeTaskPriority(priority);
		const assignedToVal = assignedTo && /^\d+$/.test(String(assignedTo)) ? Number(assignedTo) : null;

		conn = await db.getConnection();

		const projectRows = await conn.query('SELECT id FROM projects WHERE id=? LIMIT 1', [Number(projectId)]);
		if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

		if (assignedToVal) {
			const uRows = await conn.query('SELECT id FROM users WHERE id=? LIMIT 1', [assignedToVal]);
			if (!uRows.length) return res.status(404).json({ error: 'Assigned user not found' });
		}

		const result = await conn.query(
			`INSERT INTO tasks(project_id,assigned_to,title,description,priority,status,estimated_hours,start_date,due_date,created_by)
			VALUES(?,?,?,?,?,?,?,?,?,?)`,
			[Number(projectId), assignedToVal, String(title).trim(), description || null, normPriority, normStatus,
				estimatedHours ? parseFloat(estimatedHours) : null, toDbDate(startDate), toDbDate(dueDate), req.session.user.id]
		);

		const newTaskId = Number(result.insertId);

		if (assignedToVal && assignedToVal !== req.session.user.id) {
			await createNotification(conn, assignedToVal, 'New Task Assigned',
				`You have been assigned: "${String(title).trim()}"`, 'info', 'task', newTaskId);
		}
		await logActivity(conn, req.session.user.id, 'created task', 'task', newTaskId,
			`Created task: "${String(title).trim()}"`, req.ip);

		return res.status(201).json({ success: true, message: 'Task created successfully', taskId: newTaskId });
	} catch (err) {
		console.error('addTask error:', err);
		return res.status(500).json({ error: 'Unable to create task' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── updateTask ───────────────────────────────────────────────────────────────

exports.updateTask = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

		const { projectId, assignedTo, title, description, priority, status, estimatedHours, actualHours, startDate, dueDate } = req.body || {};

		if (!title || !String(title).trim()) return res.status(400).json({ error: 'Task title is required' });
		if (!projectId || !/^\d+$/.test(String(projectId))) return res.status(400).json({ error: 'Valid project is required' });

		const normStatus = normalizeTaskStatus(status);
		const normPriority = normalizeTaskPriority(priority);
		const assignedToVal = assignedTo && /^\d+$/.test(String(assignedTo)) ? Number(assignedTo) : null;
		const completedDate = normStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null;

		conn = await db.getConnection();

		const existing = await conn.query('SELECT id, assigned_to, status, title FROM tasks WHERE id=? LIMIT 1', [taskId]);
		if (!existing.length) return res.status(404).json({ error: 'Task not found' });

		await conn.query(
			`UPDATE tasks SET project_id=?,assigned_to=?,title=?,description=?,priority=?,status=?,
			estimated_hours=?,actual_hours=?,start_date=?,due_date=?,completed_date=?,updated_at=NOW()
			WHERE id=?`,
			[Number(projectId), assignedToVal, String(title).trim(), description || null, normPriority, normStatus,
				estimatedHours ? parseFloat(estimatedHours) : null, actualHours ? parseFloat(actualHours) : null,
				toDbDate(startDate), toDbDate(dueDate), completedDate, taskId]
		);

		const prevAssigned = Number(existing[0].assigned_to);
		if (assignedToVal && assignedToVal !== prevAssigned && assignedToVal !== req.session.user.id) {
			await createNotification(conn, assignedToVal, 'Task Assigned to You',
				`Task "${String(title).trim()}" has been assigned to you`, 'info', 'task', taskId);
		}
		if (normStatus === 'completed' && existing[0].status !== 'completed') {
			await createNotification(conn, req.session.user.id, 'Task Completed',
				`Task "${String(title).trim()}" marked as completed`, 'success', 'task', taskId);
		}
		await logActivity(conn, req.session.user.id, 'updated task', 'task', taskId,
			`Updated task: "${String(title).trim()}"`, req.ip);

		return res.status(200).json({ success: true, message: 'Task updated successfully' });
	} catch (err) {
		console.error('updateTask error:', err);
		return res.status(500).json({ error: 'Unable to update task' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── deleteTask ───────────────────────────────────────────────────────────────

exports.deleteTask = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

		conn = await db.getConnection();
		const existing = await conn.query('SELECT id, title FROM tasks WHERE id=? LIMIT 1', [taskId]);
		if (!existing.length) return res.status(404).json({ error: 'Task not found' });

		// Delete physical attachment files
		const attachments = await conn.query('SELECT file_path FROM task_attachments WHERE task_id=?', [taskId]);
		for (const att of attachments) {
			try {
				const filePath = path.join(__dirname, '../../public', att.file_path);
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			} catch (_e) { /* ignore individual file deletion errors */ }
		}

		await conn.query('DELETE FROM tasks WHERE id=?', [taskId]);
		await logActivity(conn, req.session.user.id, 'deleted task', 'task', taskId,
			`Deleted task: "${existing[0].title}"`, req.ip);

		return res.status(200).json({ success: true, message: 'Task deleted successfully' });
	} catch (err) {
		console.error('deleteTask error:', err);
		return res.status(500).json({ error: 'Unable to delete task' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── updateTaskStatus (Kanban drag-drop) ─────────────────────────────────────

exports.updateTaskStatus = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		const { status } = req.body || {};
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

		const normStatus = normalizeTaskStatus(status);
		conn = await db.getConnection();

		const existing = await conn.query('SELECT id, title, assigned_to FROM tasks WHERE id=? LIMIT 1', [taskId]);
		if (!existing.length) return res.status(404).json({ error: 'Task not found' });

		// Employees can only update tasks assigned to them
		if (req.session.user.role === 'employee' && Number(existing[0].assigned_to) !== req.session.user.id) {
			return res.status(403).json({ error: 'You can only update your own tasks' });
		}

		const completedDate = normStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null;
		await conn.query('UPDATE tasks SET status=?,completed_date=?,updated_at=NOW() WHERE id=?',
			[normStatus, completedDate, taskId]);

		await logActivity(conn, req.session.user.id, `changed task status to ${normStatus}`,
			'task', taskId, `"${existing[0].title}" → ${normStatus}`, req.ip);

		return res.status(200).json({ success: true, message: 'Status updated' });
	} catch (err) {
		console.error('updateTaskStatus error:', err);
		return res.status(500).json({ error: 'Unable to update status' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── Attachments ──────────────────────────────────────────────────────────────

exports.uploadAttachment = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });
		if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

		conn = await db.getConnection();
		const existing = await conn.query('SELECT id FROM tasks WHERE id=? LIMIT 1', [taskId]);
		if (!existing.length) return res.status(404).json({ error: 'Task not found' });

		const filePath = `/uploads/tasks/${taskId}/${req.file.filename}`;
		const result = await conn.query(
			`INSERT INTO task_attachments(task_id,filename,original_name,file_path,file_size,mime_type,uploaded_by)
			VALUES(?,?,?,?,?,?,?)`,
			[taskId, req.file.filename, req.file.originalname, filePath, req.file.size, req.file.mimetype, req.session.user.id]
		);
		await logActivity(conn, req.session.user.id, 'uploaded attachment', 'task', taskId,
			`Uploaded: ${req.file.originalname}`, req.ip);

		return res.status(201).json({
			success: true,
			attachment: {
				id: Number(result.insertId), filename: req.file.filename,
				original_name: req.file.originalname, file_path: filePath,
				file_size: req.file.size, mime_type: req.file.mimetype
			}
		});
	} catch (err) {
		console.error('uploadAttachment error:', err);
		return res.status(500).json({ error: 'Unable to upload attachment' });
	} finally {
		if (conn) conn.release();
	}
};

exports.deleteAttachment = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		const attId = Number(req.params.aid);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });
		if (!Number.isInteger(attId) || attId <= 0) return res.status(400).json({ error: 'Invalid attachment id' });

		conn = await db.getConnection();
		const rows = await conn.query('SELECT * FROM task_attachments WHERE id=? AND task_id=? LIMIT 1', [attId, taskId]);
		if (!rows.length) return res.status(404).json({ error: 'Attachment not found' });

		const att = rows[0];
		// Only the uploader, admin, or super_admin can delete
		if (Number(att.uploaded_by) !== req.session.user.id && !['super_admin', 'admin'].includes(req.session.user.role)) {
			return res.status(403).json({ error: 'You can only delete your own attachments' });
		}

		try {
			const filePath = path.join(__dirname, '../../public', att.file_path);
			if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
		} catch (_e) { /* ignore */ }

		await conn.query('DELETE FROM task_attachments WHERE id=?', [attId]);
		return res.status(200).json({ success: true, message: 'Attachment deleted' });
	} catch (err) {
		console.error('deleteAttachment error:', err);
		return res.status(500).json({ error: 'Unable to delete attachment' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── Comments ─────────────────────────────────────────────────────────────────

exports.getComments = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });

		conn = await db.getConnection();
		const comments = await conn.query(
			`SELECT tc.*, CONCAT(u.first_name,' ',u.last_name) AS author_name
			FROM task_comments tc
			JOIN users u ON u.id = tc.user_id
			WHERE tc.task_id = ? ORDER BY tc.created_at DESC`,
			[taskId]
		);
		return res.status(200).json({ success: true, comments: comments || [] });
	} catch (err) {
		console.error('getComments error:', err);
		return res.status(500).json({ error: 'Unable to fetch comments' });
	} finally {
		if (conn) conn.release();
	}
};

exports.addComment = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		const { content } = req.body || {};
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });
		if (!content || !String(content).trim()) return res.status(400).json({ error: 'Comment content is required' });

		conn = await db.getConnection();
		const existing = await conn.query('SELECT id, title, assigned_to FROM tasks WHERE id=? LIMIT 1', [taskId]);
		if (!existing.length) return res.status(404).json({ error: 'Task not found' });

		const result = await conn.query(
			'INSERT INTO task_comments(task_id,user_id,content) VALUES(?,?,?)',
			[taskId, req.session.user.id, String(content).trim()]
		);

		const task = existing[0];
		if (task.assigned_to && Number(task.assigned_to) !== req.session.user.id) {
			await createNotification(conn, Number(task.assigned_to), 'New Comment on Your Task',
				`New comment on: "${task.title}"`, 'info', 'task', taskId);
		}

		return res.status(201).json({ success: true, commentId: Number(result.insertId), message: 'Comment added' });
	} catch (err) {
		console.error('addComment error:', err);
		return res.status(500).json({ error: 'Unable to add comment' });
	} finally {
		if (conn) conn.release();
	}
};

exports.updateComment = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		const commentId = Number(req.params.cid);
		const { content } = req.body || {};
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });
		if (!Number.isInteger(commentId) || commentId <= 0) return res.status(400).json({ error: 'Invalid comment id' });
		if (!content || !String(content).trim()) return res.status(400).json({ error: 'Content is required' });

		conn = await db.getConnection();
		const rows = await conn.query('SELECT * FROM task_comments WHERE id=? AND task_id=? LIMIT 1', [commentId, taskId]);
		if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

		const comment = rows[0];
		if (Number(comment.user_id) !== req.session.user.id && req.session.user.role !== 'super_admin') {
			return res.status(403).json({ error: 'You can only edit your own comments' });
		}

		await conn.query('UPDATE task_comments SET content=?,is_edited=1,updated_at=NOW() WHERE id=?',
			[String(content).trim(), commentId]);
		return res.status(200).json({ success: true, message: 'Comment updated' });
	} catch (err) {
		console.error('updateComment error:', err);
		return res.status(500).json({ error: 'Unable to update comment' });
	} finally {
		if (conn) conn.release();
	}
};

exports.deleteComment = async (req, res) => {
	let conn;
	try {
		const taskId = Number(req.params.id);
		const commentId = Number(req.params.cid);
		if (!Number.isInteger(taskId) || taskId <= 0) return res.status(400).json({ error: 'Invalid task id' });
		if (!Number.isInteger(commentId) || commentId <= 0) return res.status(400).json({ error: 'Invalid comment id' });

		conn = await db.getConnection();
		const rows = await conn.query('SELECT * FROM task_comments WHERE id=? AND task_id=? LIMIT 1', [commentId, taskId]);
		if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

		const comment = rows[0];
		if (Number(comment.user_id) !== req.session.user.id && !['super_admin', 'admin'].includes(req.session.user.role)) {
			return res.status(403).json({ error: 'You can only delete your own comments' });
		}

		await conn.query('DELETE FROM task_comments WHERE id=?', [commentId]);
		return res.status(200).json({ success: true, message: 'Comment deleted' });
	} catch (err) {
		console.error('deleteComment error:', err);
		return res.status(500).json({ error: 'Unable to delete comment' });
	} finally {
		if (conn) conn.release();
	}
};

// ─── getTasksForCalendar ──────────────────────────────────────────────────────
// Returns tasks with due dates for a given year/month

exports.getTasksForCalendar = async (req, res) => {
	let conn;
	try {
		const { year, month } = req.query;
		if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

		conn = await db.getConnection();
		let sql = `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
			p.project_name, CONCAT(u.first_name,' ',u.last_name) AS assigned_name
			FROM tasks t
			LEFT JOIN projects p ON p.id = t.project_id
			LEFT JOIN users u ON u.id = t.assigned_to
			WHERE YEAR(t.due_date)=? AND MONTH(t.due_date)=?`;
		const params = [parseInt(year), parseInt(month)];

		if (req.session.user.role === 'employee') {
			sql += ' AND t.assigned_to=?';
			params.push(req.session.user.id);
		}
		sql += ' ORDER BY t.due_date ASC';

		const tasks = await conn.query(sql, params);
		return res.status(200).json({ success: true, tasks: tasks || [] });
	} catch (err) {
		console.error('getTasksForCalendar error:', err);
		return res.status(500).json({ error: 'Unable to fetch calendar tasks' });
	} finally {
		if (conn) conn.release();
	}
};
