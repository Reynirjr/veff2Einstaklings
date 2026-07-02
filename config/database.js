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

let sequelize;
if (config.db.url) {
  sequelize = new Sequelize(config.db.url, { ...common, dialectOptions: sslOptions });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    ...common,
    host: config.db.host,
    port: config.db.port,
    ...(usesManagedSsl ? { dialectOptions: sslOptions } : {}),
  });
}

module.exports = sequelize;
