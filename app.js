const express = require('express');
const userRoutes = require('./server/routes/userRoutes');

const app = express();
const PORT = 3000;

// Parse JSON and normal form payloads.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
	res.redirect('/login');
});

app.get('/register', (req, res) => {
	res.render('register');
});

app.get('/login', (req, res) => {
	res.render('login');
});

app.get('/users-page', (req, res) => {
	res.render('usersc', { name: req.query.name || 'User', activePage: 'users' });
});

app.get('/projects-page', (req, res) => {
	res.render('projects', { name: req.query.name || 'User', activePage: 'projects' });
});

app.get('/dashboard', (req, res) => {
	const name = encodeURIComponent(req.query.name || 'User');
	res.redirect(`/users-page?name=${name}`);
});

app.use('/', userRoutes);

app.use((err, req, res, next) => {
	if (err && err.type === 'entity.parse.failed') {
		return res.status(400).json({ error: 'Invalid JSON payload' });
	}

	if (err) {
		console.error('Unhandled server error:', err);
		return res.status(500).json({ error: 'Server error' });
	}

	next();
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});