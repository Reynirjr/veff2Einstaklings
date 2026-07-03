'use strict';

/**
 * The single Sequelize instance for the whole application.
 *
 * Previously two separate instances existed (this file and models/index.js),
 * each with its own connection pool. Everything now imports this one — models
 * and raw `sequelize.query(...)` sites alike — so there is a single pool.
 */

const { Sequelize } = require('sequelize');
const { config } = require('./env');

const common = {
  dialect: 'postgres',
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
};

// Managed hosts (Railway, Heroku, …) provide a single connection string and
// require SSL. Detect that path via DATABASE_URL or a railway-style host.
const usesManagedSsl =
  !!config.db.url ||
  (config.db.host &&
    (config.db.host.includes('railway') || config.db.host.includes('rlwy')));

const sslOptions = {
  ssl: { require: true, rejectUnauthorized: false },
};

// A connection string may target a plaintext internal network (Railway's
// *.railway.internal) that rejects SSL, or explicitly disable it. Only apply
// SSL when the URL isn't one of those.
function urlWantsSsl(url) {
  if (/sslmode=disable/i.test(url)) return false;
  if (url.includes('.railway.internal')) return false;
  return true;
}

let sequelize;
if (config.db.url) {
  const urlOpts = urlWantsSsl(config.db.url) ? { dialectOptions: sslOptions } : {};
  sequelize = new Sequelize(config.db.url, { ...common, ...urlOpts });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    ...common,
    host: config.db.host,
    port: config.db.port,
    ...(usesManagedSsl ? { dialectOptions: sslOptions } : {}),
  });
}

module.exports = sequelize;
