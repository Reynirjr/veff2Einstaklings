'use strict';

const { config, validate } = require('./config/env');
const db = require('./models');
const createApp = require('./app');
const { startRoundJob } = require('./jobs/roundJob');

validate(); // fail fast on missing env

const app = createApp();

async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected.');

    if (config.isProduction && !config.dbSync) {
      console.log('Production: using migrations for schema.');
      // Targeted, additive-only sync: creates these standalone tables if they
      // don't exist yet, without touching any other table.
      await db.PushSubscription.sync();
      await db.RoundReminder.sync();
    } else {
      await db.sequelize.sync({ alter: true });
      console.log(`Database synced (${config.nodeEnv}${config.dbSync ? ', DB_SYNC' : ''}).`);
    }

    startRoundJob();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
