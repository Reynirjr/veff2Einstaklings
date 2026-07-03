'use strict';

const roundService = require('../services/roundService');
const emailService = require('../services/emailService');

const INTERVAL_MS = 60 * 1000;

/**
 * Periodically reconcile every group's rounds (advance phases, finalize
 * expired voting rounds, spawn the next/first round) and send the day-of
 * reminder emails. This is the single background driver of the lifecycle.
 *
 * @returns {NodeJS.Timeout} the interval handle (so callers can stop it)
 */
function startRoundJob() {
  const run = () => {
    roundService.reconcile().catch((err) => {
      console.error('[roundJob] reconcile failed:', err);
    });
    emailService.sendDailyReminders().catch((err) => {
      console.error('[roundJob] reminder emails failed:', err);
    });
  };
  run(); // run once on boot
  return setInterval(run, INTERVAL_MS);
}

module.exports = { startRoundJob, INTERVAL_MS };
