/**
 * authorize(...roles) — role-based access middleware factory.
 * Usage: router.get('/users', authenticate, authorize('super_admin', 'admin'), handler)
 *
 * If the session user's role is not in the allowed list, renders the 403 access-denied page.
 */
function authorize(...allowedRoles) {
	return function (req, res, next) {
		const user = req.session && req.session.user;

		if (!user) {
			return res.redirect('/login');
		}

		if (!allowedRoles.includes(user.role)) {
			return res.status(403).render('access-denied', {
				sessionUser: user
			});
		}

		next();
	};
}

module.exports = authorize;
