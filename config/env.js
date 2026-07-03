'use strict';

/**
 * Centralised, validated environment configuration.
 *
 * Everything in the app reads its settings from here rather than touching
 * `process.env` directly, so there is exactly one place that knows the shape
 * of the environment (and one place that fails loudly when it is misconfigured).
 */

require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

/**
 * Read a variable, falling back to a default. When no default is given the
 * variable is considered required and its name is collected for validation.
 */
const missing = [];
function read(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback === undefined) {
      missing.push(name);
      return undefined;
    }
    return fallback;
  }
  return value;
}

// When a full DATABASE_URL is supplied (Railway / Heroku style) the individual
// DB_* variables are not needed, so they must not be treated as "required".
const hasDbUrl = !!process.env.DATABASE_URL;
const dbFallback = (testValue) =>
  isTest ? testValue : hasDbUrl ? null : undefined;

// Schema bootstrap: normally production runs migrations, but setting
// DB_SYNC=true (e.g. for a first deploy before migrations are wired up) makes
// the app create/alter the schema from the models on boot.
const dbSync = ['1', 'true', 'alter', 'yes'].includes(
  String(process.env.DB_SYNC || '').toLowerCase()
);

const config = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(read('PORT', 3000)),

  // Secret used both to sign JWTs and (reused) to sign the flash cookie.
  jwtSecret: read('JWT_SECRET', isTest ? 'test-secret' : undefined),
  jwtExpiresIn: read('JWT_EXPIRES_IN', '1h'),

  dbSync,

  db: {
    // A full connection string (Railway / Heroku style) takes precedence when present.
    url: process.env.DATABASE_URL || null,
    host: read('DB_HOST', dbFallback('localhost')),
    port: Number(read('DB_PORT', 5432)),
    name: read('DB_NAME', dbFallback('tonaleikarnir_test')),
    user: read('DB_USER', dbFallback('postgres')),
    password: read('DB_PASSWORD', dbFallback('')),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: process.env.CLOUDINARY_API_KEY || null,
    apiSecret: process.env.CLOUDINARY_API_SECRET || null,
  },

  // Web Push (VAPID). Optional — when the keys are missing, push features are
  // simply disabled (the bell button hides itself and sends become no-ops).
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
    subject: process.env.VAPID_SUBJECT || 'mailto:benjamin@onnio.is',
  },

  // Absolute base URL used in outbound emails (links back to the app).
  appUrl: (process.env.APP_URL || 'https://veff2einstaklings-production.up.railway.app').replace(/\/$/, ''),

  // SMTP for reminder emails. Optional — when unset, email features are no-ops.
  email: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || null,
    // Hour of day (server clock = UTC = Icelandic time) for the day-of reminder.
    reminderHour: Number(process.env.REMINDER_HOUR || 9),
  },
};

/**
 * Fail fast with a clear message rather than crashing later with a cryptic
 * "connection refused" or "jwt must be provided". Skipped under test, where
 * sensible defaults are supplied above.
 */
function validate() {
  if (isTest) return;
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy the example from the README into a .env file.'
    );
  }
}

module.exports = { config, validate };
