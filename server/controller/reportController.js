const PDFDocument = require('pdfkit');
const db = require('../db/connection');

// ─── CSV helper ──────────────────────────────────────────────────────────────

function buildCsv(headers, rows) {
	const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
	const headerLine = headers.join(',');
	const dataLines = rows.map(row => row.map(escape).join(','));
	return [headerLine, ...dataLines].join('\n');
}

function sendCsv(res, filename, csv) {
	res.setHeader('Content-Type', 'text/csv; charset=utf-8');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	return res.send('\uFEFF' + csv); // BOM for Excel UTF-8
}

// ─── PDF helper ───────────────────────────────────────────────────────────────

function buildPdf(res, title, headers, rows, filename) {
	const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	doc.pipe(res);

	// Title
	doc.fontSize(18).fillColor('#1e293b').text('ProTrack — ' + title, { align: 'center' });
	doc.fontSize(9).fillColor('#64748b').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
	doc.moveDown(1);

	// Calculate column widths
	const pageWidth = doc.page.width - 80;
	const colWidth = Math.floor(pageWidth / headers.length);

	// Header row
	const startX = 40;
	let y = doc.y;
	doc.rect(startX, y, pageWidth, 18).fill('#0f172a');
	doc.fillColor('#ffffff').fontSize(8);
	headers.forEach((h, i) => {
		doc.text(h, startX + i * colWidth + 4, y + 4, { width: colWidth - 8 });
	});

	// Data rows
	let rowY = y + 20;
	doc.fontSize(7).fillColor('#1e293b');
	rows.forEach((row, rowIdx) => {
		if (rowY > doc.page.height - 60) {
			doc.addPage({ layout: 'landscape', margin: 40 });
			rowY = 40;
		}
		const bg = rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
		doc.rect(startX, rowY, pageWidth, 16).fill(bg);
		doc.fillColor('#1e293b');
		row.forEach((cell, i) => {
			const cellStr = String(cell == null ? '' : cell).slice(0, 40);
			doc.text(cellStr, startX + i * colWidth + 4, rowY + 3, { width: colWidth - 8 });
		});
		rowY += 18;
	});

	doc.end();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

exports.exportProjectsCsv = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT id, project_name, description, start_date, end_date, status FROM projects ORDER BY id DESC`
		);
		const csv = buildCsv(
			['ID', 'Project Name', 'Description', 'Start Date', 'End Date', 'Status'],
			rows.map(r => [r.id, r.project_name, r.description, r.start_date, r.end_date, r.status])
		);
		return sendCsv(res, 'projects_report.csv', csv);
	} catch (err) {
		console.error('exportProjectsCsv error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};

exports.exportProjectsPdf = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT id, project_name, description, start_date, end_date, status FROM projects ORDER BY id DESC`
		);
		return buildPdf(res, 'Projects Report',
			['ID', 'Project Name', 'Start Date', 'End Date', 'Status'],
			rows.map(r => [r.id, r.project_name, r.start_date, r.end_date, r.status]),
			'projects_report.pdf'
		);
	} catch (err) {
		console.error('exportProjectsPdf error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};

exports.exportTasksCsv = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT t.id, t.title, t.priority, t.status, t.estimated_hours, t.actual_hours,
				t.start_date, t.due_date, t.completed_date, p.project_name,
				CONCAT(u.first_name,' ',u.last_name) AS assigned_to
			FROM tasks t
			LEFT JOIN projects p ON p.id=t.project_id
			LEFT JOIN users u ON u.id=t.assigned_to
			ORDER BY t.id DESC`
		);
		const csv = buildCsv(
			['ID', 'Title', 'Project', 'Assigned To', 'Priority', 'Status', 'Est. Hours', 'Actual Hours', 'Start Date', 'Due Date', 'Completed Date'],
			rows.map(r => [r.id, r.title, r.project_name, r.assigned_to, r.priority, r.status,
				r.estimated_hours, r.actual_hours, r.start_date, r.due_date, r.completed_date])
		);
		return sendCsv(res, 'tasks_report.csv', csv);
	} catch (err) {
		console.error('exportTasksCsv error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};

exports.exportTasksPdf = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT t.id, t.title, p.project_name, t.priority, t.status, t.due_date,
				CONCAT(u.first_name,' ',u.last_name) AS assigned_to
			FROM tasks t
			LEFT JOIN projects p ON p.id=t.project_id
			LEFT JOIN users u ON u.id=t.assigned_to
			ORDER BY t.id DESC`
		);
		return buildPdf(res, 'Tasks Report',
			['ID', 'Title', 'Project', 'Assigned To', 'Priority', 'Status', 'Due Date'],
			rows.map(r => [r.id, r.title, r.project_name, r.assigned_to, r.priority, r.status, r.due_date]),
			'tasks_report.pdf'
		);
	} catch (err) {
		console.error('exportTasksPdf error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};

exports.exportUsersCsv = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.status,
				ep.designation, ep.department
			FROM users u
			LEFT JOIN employee_profiles ep ON ep.user_id=u.id
			ORDER BY u.id DESC`
		);
		const csv = buildCsv(
			['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Status', 'Designation', 'Department'],
			rows.map(r => [r.id, r.first_name, r.last_name, r.email, r.phone, r.role, r.status, r.designation, r.department])
		);
		return sendCsv(res, 'users_report.csv', csv);
	} catch (err) {
		console.error('exportUsersCsv error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};

exports.exportUsersPdf = async (req, res) => {
	let conn;
	try {
		conn = await db.getConnection();
		const rows = await conn.query(
			`SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, ep.department
			FROM users u
			LEFT JOIN employee_profiles ep ON ep.user_id=u.id
			ORDER BY u.id DESC`
		);
		return buildPdf(res, 'Users Report',
			['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Status', 'Department'],
			rows.map(r => [r.id, r.first_name, r.last_name, r.email, r.role, r.status, r.department]),
			'users_report.pdf'
		);
	} catch (err) {
		console.error('exportUsersPdf error:', err);
		return res.status(500).json({ error: 'Export failed' });
	} finally {
		if (conn) conn.release();
	}
};
