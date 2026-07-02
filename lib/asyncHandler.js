'use strict';

/**
 * Wrap an async route handler so a rejected promise is forwarded to Express's
 * error middleware instead of hanging the request. Removes the repetitive
 * try/catch blocks that used to wrap every controller action.
 *
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
