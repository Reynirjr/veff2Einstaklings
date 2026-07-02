'use strict';

const { doubleCsrf } = require('csrf-csrf');
const { config } = require('../config/env');

/**
 * CSRF protection via the maintained `csrf-csrf` (double-submit cookie),
 * replacing the deprecated, unmaintained `csurf`. One instance for the whole
 * app. Templates keep using a hidden `_csrf` field and `res.locals.csrfToken`,
 * so no view changes are needed.
 */

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.jwtSecret,
  // __Host- prefix requires https; only use it in production.
  cookieName: config.isProduction ? '__Host-tl.csrf' : 'tl.csrf',
  cookieOptions: {
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  },
  size: 64,
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || (req.body && req.body._csrf),
});

/**
 * Make a token available to rendered views (including forms re-rendered after a
 * failed POST, e.g. signup validation errors).
 *
 * This runs AFTER `csrfGuard`, so minting here never rotates the cookie before
 * validation for normal requests. The one exception is multipart requests: their
 * CSRF is validated later, inside the route (after multer), so we must NOT mint
 * here or we'd rotate the cookie before that in-route check.
 */
function attachCsrfToken(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    res.locals.csrfToken = generateToken(req, res);
  }
  next();
}

/**
 * Global guard. `doubleCsrfProtection` already ignores safe methods (GET/HEAD/
 * OPTIONS); we additionally skip multipart requests so the file-upload route
 * can validate CSRF *after* multer has parsed the `_csrf` field from the body.
 */
function csrfGuard(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) return next();
  return doubleCsrfProtection(req, res, next);
}

module.exports = {
  attachCsrfToken,
  csrfGuard,
  csrfProtection: doubleCsrfProtection,
  generateToken,
};
