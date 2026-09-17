const path = require('path');
const multer = require('multer');
const db = require('../db/connection');

// ─── Multer configuration ────────────────────────────────────────────────────

const AVATAR_DIR = path.join(__dirname, '../../public/uploads/avatars');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
	destination: function (_req, _file, cb) {
		cb(null, AVATAR_DIR);
	},
	filename: function (req, _file, cb) {
		const ext = _file.originalname.split('.').pop().toLowerCase();
		cb(null, `avatar_${req.session.user.id}_${Date.now()}.${ext}`);
	}
});

const fileFilter = function (_req, file, cb) {
	if (ALLOWED_MIME.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Only image files (jpg, png, gif, webp) are allowed'), false);
	}
};

const upload = multer({
	storage,
	limits: { fileSize: MAX_SIZE_BYTES },
	fileFilter
});

/** Express middleware that handles avatar upload. Attach to profile edit route. */
exports.uploadAvatar = upload.single('avatar');

// ─── Profile controllers ─────────────────────────────────────────────────────

exports.getProfile = async (req, res) => {
	let conn;

	try {
		const userId = req.session.user.id;

		conn = await db.getConnection();

		const userRows = await conn.query(
			`SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.role,
				ep.designation, ep.department, ep.skills, ep.experience,
				ep.joining_date, ep.address, ep.bio, ep.avatar
			FROM users u
			LEFT JOIN employee_profiles ep ON ep.user_id = u.id
			WHERE u.id = ? LIMIT 1`,
			[userId]
		);

		if (!userRows.length) {
			return res.redirect('/login');
		}

		return res.render('profile', {
			profile: userRows[0],
			activePage: 'profile'
		});
	} catch (err) {
		console.error('getProfile error:', err);
		return res.status(500).json({ error: 'Unable to load profile' });
	} finally {
		if (conn) conn.release();
	}
};

exports.getProfileEdit = async (req, res) => {
	let conn;

	try {
		const userId = req.session.user.id;

		conn = await db.getConnection();

		const userRows = await conn.query(
			`SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.role,
				ep.designation, ep.department, ep.skills, ep.experience,
				ep.joining_date, ep.address, ep.bio, ep.avatar
			FROM users u
			LEFT JOIN employee_profiles ep ON ep.user_id = u.id
			WHERE u.id = ? LIMIT 1`,
			[userId]
		);

		if (!userRows.length) {
			return res.redirect('/login');
		}

		return res.render('profile-edit', {
			profile: userRows[0],
			activePage: 'profile',
			error: null
		});
	} catch (err) {
		console.error('getProfileEdit error:', err);
		return res.status(500).json({ error: 'Unable to load profile edit' });
	} finally {
		if (conn) conn.release();
	}
};

exports.updateProfile = async (req, res) => {
	let conn;

	try {
		const userId = req.session.user.id;
		const {
			firstName,
			lastName,
			phone,
			designation,
			department,
			skills,
			experience,
			joiningDate,
			address,
			bio
		} = req.body || {};

		conn = await db.getConnection();

		// Update core user fields
		await conn.query(
			'UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?',
			[firstName || '', lastName || '', phone || '', userId]
		);

		// Update session name if changed
		if (firstName) {
			req.session.user.name = firstName;
		}

		// Determine avatar path
		let avatarPath = null;
		if (req.file) {
			avatarPath = `/uploads/avatars/${req.file.filename}`;
		}

		// Upsert employee_profiles (INSERT … ON DUPLICATE KEY UPDATE)
		await conn.query(
			`INSERT INTO employee_profiles
				(user_id, designation, department, skills, experience, joining_date, address, bio, avatar)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				designation = VALUES(designation),
				department = VALUES(department),
				skills = VALUES(skills),
				experience = VALUES(experience),
				joining_date = VALUES(joining_date),
				address = VALUES(address),
				bio = VALUES(bio),
				avatar = IF(VALUES(avatar) IS NOT NULL, VALUES(avatar), avatar)`,
			[
				userId,
				designation || null,
				department || null,
				skills || null,
				experience || null,
				joiningDate || null,
				address || null,
				bio || null,
				avatarPath
			]
		);

		return res.redirect('/profile');
	} catch (err) {
		console.error('updateProfile error:', err);

		// Re-render form with error
		return res.render('profile-edit', {
			profile: req.body,
			activePage: 'profile',
			error: err.message || 'Unable to save profile'
		});
	} finally {
		if (conn) conn.release();
	}
};
