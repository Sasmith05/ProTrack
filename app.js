require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const userRoutes = require('./server/routes/userRoutes');
const dashboardController = require('./server/controller/dashboardController');
const profileController = require('./server/controller/profileController');
const authenticate = require('./server/middleware/authenticate');
const authorize = require('./server/middleware/authorize');
const { authLimiter } = require('./server/middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static('public'));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
	secret: process.env.SESSION_SECRET || 'protrack_dev_secret_change_in_production',
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		maxAge: 8 * 60 * 60 * 1000 // 8-hour session
	}
}));

// ─── Flash messages ───────────────────────────────────────────────────────────
app.use(flash());

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'SAMEORIGIN');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	next();
});

// ─── Inject flash + session into every template ───────────────────────────────
app.use((req, res, next) => {
	res.locals.flashSuccess = req.flash('success');
	res.locals.flashError = req.flash('error');
	// Inject session user so partials always have access
	res.locals.sessionUser = req.session.user || null;
	next();
});

// ─── View engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');

// ─── Public routes (no auth required) ────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
	if (req.session && req.session.user) return res.redirect('/dashboard');
	res.render('login');
});

app.get('/register', (req, res) => {
	if (req.session && req.session.user) return res.redirect('/dashboard');
	res.render('register');
});

// Apply rate limiter to auth POST routes
app.post('/login', authLimiter);
app.post('/register', authLimiter);

// ─── Protected page routes ────────────────────────────────────────────────────

// Dashboard — all authenticated users
app.get('/dashboard', authenticate, dashboardController.getDashboard);

// Users page — super_admin and admin only
app.get('/users-page', authenticate, authorize('super_admin', 'admin'), (req, res) => {
	res.render('usersc', { activePage: 'users' });
});

// Projects page — all authenticated users
app.get('/projects-page', authenticate, (req, res) => {
	res.render('projects', { activePage: 'projects' });
});

// Tasks page — all authenticated users
app.get('/tasks-page', authenticate, (req, res) => {
	res.render('tasks', { activePage: 'tasks' });
});

// Kanban board — all authenticated users
app.get('/kanban-page', authenticate, (req, res) => {
	res.render('kanban', { activePage: 'kanban' });
});

// Calendar page — all authenticated users
app.get('/calendar-page', authenticate, (req, res) => {
	res.render('calendar', { activePage: 'calendar' });
});

// Reports page — managers and above
app.get('/reports-page', authenticate, authorize('super_admin', 'admin', 'project_manager'), (req, res) => {
	res.render('reports', { activePage: 'reports' });
});

// Activity log page — admin and above
app.get('/activity-page', authenticate, authorize('super_admin', 'admin'), (req, res) => {
	res.render('activity', { activePage: 'activity' });
});

// Profile pages
app.get('/profile', authenticate, profileController.getProfile);
app.get('/profile/edit', authenticate, profileController.getProfileEdit);

// ─── API + auth routes ────────────────────────────────────────────────────────
app.use('/', userRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
	if (err && err.type === 'entity.parse.failed') {
		return res.status(400).json({ error: 'Invalid JSON payload' });
	}

	// Multer file size/type errors
	if (err && err.code === 'LIMIT_FILE_SIZE') {
		return res.status(400).json({ error: 'File too large. Maximum size is 2 MB.' });
	}

	if (err) {
		console.error('Unhandled server error:', err);
		return res.status(500).json({ error: 'Server error' });
	}

	next();
});

// Vercel imports the app as a serverless handler; local development still uses
// the regular Node listener.
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`ProTrack running on http://localhost:${PORT}`);
	});
}

module.exports = app;