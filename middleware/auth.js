'use strict';

const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { User } = require('../models');

/**
 * Auth middleware.
 *
 * `attachUser` runs globally and best-effort: if a valid JWT cookie is present
 * it loads the user onto req/res.locals (for views); otherwise it does nothing.
 * `requireAuth` guards protected routes and redirects anonymous users to login.
 */

const TOKEN_COOKIE = 'token';

async function attachUser(req, res, next) {
  res.locals.isAuthenticated = false;
  const token = req.cookies[TOKEN_COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findByPk(decoded.id);
      if (user) {
        req.user = user;
        res.locals.user = user;
        res.locals.isAuthenticated = true;
      } else {
        res.clearCookie(TOKEN_COOKIE);
      }
    } catch (err) {
      res.clearCookie(TOKEN_COOKIE);
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?error=unauthorized');
  }
  next();
}

/** Sign and set the auth cookie for a freshly authenticated user. */
function issueToken(res, user) {
  const token = jwt.sign({ id: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 60 * 60 * 1000,
  });
}

function clearToken(res) {
  res.clearCookie(TOKEN_COOKIE);
}

module.exports = { attachUser, requireAuth, issueToken, clearToken, TOKEN_COOKIE };
