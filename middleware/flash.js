'use strict';

/**
 * Stateless, cookie-based flash messages.
 *
 * The previous implementation stored flashes on `req.session`, but no session
 * middleware was ever installed — so messages silently never survived the
 * redirect. This keeps them in a short-lived cookie instead: no session store
 * required.
 *
 * Usage:
 *   res.flash('success', 'Saved!');   // before a redirect
 *   // in the view: <%= flash.success %>
 */

const FLASH_COOKIE = 'flash';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 1000 };

function flashMiddleware(req, res, next) {
  // Surface any incoming flash to the view, then consume it (show once).
  let incoming = {};
  if (req.cookies && req.cookies[FLASH_COOKIE]) {
    try {
      incoming = JSON.parse(req.cookies[FLASH_COOKIE]);
    } catch (err) {
      incoming = {};
    }
    res.clearCookie(FLASH_COOKIE, { path: '/' });
  }
  res.locals.flash = incoming;

  const pending = {};
  res.flash = (type, message) => {
    pending[type] = message;
    res.cookie(FLASH_COOKIE, JSON.stringify(pending), COOKIE_OPTS);
  };

  next();
}

module.exports = flashMiddleware;
