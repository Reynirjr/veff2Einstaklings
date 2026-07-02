'use strict';

/**
 * Central 404 + error handling. Controllers can throw / call next(err) and land
 * here instead of each repeating try/catch + res.status(500) boilerplate.
 */

function notFound(req, res) {
  res.status(404).render('error', { message: 'Page not found' });
}

// Express recognises an error handler by its four arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', { message: 'Invalid or expired form token. Please try again.' });
  }
  console.error('[error]', err);
  const message =
    err && err.expose && err.message ? err.message : 'Something went wrong.';
  res.status(err && err.status ? err.status : 500).render('error', { message });
}

module.exports = { notFound, errorHandler };
