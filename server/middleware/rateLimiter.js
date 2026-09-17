const rateLimit = require('express-rate-limit');

/**
 * authLimiter — restricts login/register to 15 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 15,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests. Please wait 15 minutes and try again.' },
	skipSuccessfulRequests: true
});

module.exports = { authLimiter };

