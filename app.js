'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const { config } = require('./config/env');
const flash = require('./middleware/flash');
const { attachUser } = require('./middleware/auth');
const { attachCsrfToken, csrfGuard } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const viewHelpers = require('./lib/viewHelpers');
const routes = require('./routes');

/**
 * Build the Express application. This intentionally does NOT connect to the DB
 * or start listening — that happens in server.js — so tests and tooling can
 * require the module graph without opening a connection.
 */
function createApp() {
  const app = express();

  // Sensible view locals defaults (so header.ejs never sees undefined).
  app.use((req, res, next) => {
    res.locals.isAuthenticated = false;
    res.locals.user = null;
    next();
  });

  app.use(buildHelmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(config.jwtSecret));

  app.use(flash);
  app.use(attachUser);

  // CSRF: guard mutating requests first, then mint a token for rendered pages.
  app.use(csrfGuard);
  app.use(attachCsrfToken);

  // Presentation helpers available to every template.
  app.use((req, res, next) => {
    Object.assign(res.locals, viewHelpers);
    // Public VAPID key for the push-subscribe button (empty = push disabled).
    res.locals.vapidPublicKey = config.vapid.publicKey || '';
    next();
  });

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

function buildHelmet() {
  if (!config.isProduction) {
    return helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    });
  }
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.youtube.com', 'https://s.ytimg.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://youtube.com'],
        imgSrc: ["'self'", 'https://i.ytimg.com', 'https://res.cloudinary.com', 'data:'],
        connectSrc: ["'self'", 'https://api.cloudinary.com'],
      },
    },
  });
}

module.exports = createApp;
