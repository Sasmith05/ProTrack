/**
 * authenticate middleware
 * Checks that a valid session exists. If not, redirects to /login.
 * Attaches session user to res.locals so every EJS template can access it.
 */
function authenticate(req, res, next) {
	if (!req.session || !req.session.user) {
		return res.redirect('/login');
	}

	// Make session data available to all EJS templates
	res.locals.sessionUser = req.session.user;
	next();
}

module.exports = authenticate;
