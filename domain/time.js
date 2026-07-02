'use strict';

/**
 * Pure date/time helpers for building round schedules.
 *
 * Groups store *times of day* ("08:00:00"); rounds store *full datetimes*.
 * These helpers combine the two and advance dates by a recurrence, in one place
 * so the ~4 copies of `.setHours(...)` scattered across the old routes are gone.
 */

/**
 * Return a new Date on the same calendar day as `date` but at the given
 * "HH:MM" or "HH:MM:SS" time of day.
 */
function combineDateWithTime(date, timeString) {
  const [h = 0, m = 0, s = 0] = String(timeString).split(':').map(Number);
  const result = new Date(date);
  result.setHours(h, m, s || 0, 0);
  return result;
}

/**
 * Advance a date by one recurrence step. Returns null for 'none'.
 */
function addRecurrence(date, recurrence) {
  const next = new Date(date);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      return next;
    case 'monthly': {
      // Clamp to the last day of the target month so day-29/30/31 starts don't
      // overflow (e.g. Jan 31 must not roll to Mar 3).
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      return next;
    }
    case 'none':
    default:
      return null;
  }
}

/**
 * Build the four datetimes of a round from a start date + a group's times of
 * day. `inputClose` collapses onto `votingOpen` (no gap between phases), and
 * `votingClose` rolls to the next day when it would land before `votingOpen`.
 *
 * @returns {{inputOpen: Date, inputClose: Date, votingOpen: Date, votingClose: Date}}
 */
function buildRoundWindow(startDate, group) {
  const inputOpen = combineDateWithTime(startDate, group.inputOpenTime);
  const votingOpen = combineDateWithTime(startDate, group.votingOpenTime);
  const votingClose = combineDateWithTime(startDate, group.votingCloseTime);
  if (votingClose < votingOpen) {
    votingClose.setDate(votingClose.getDate() + 1);
  }
  // inputClose is its own Date instance (a copy of votingOpen), not a shared
  // reference, so later mutation of one can't silently shift the other.
  return { inputOpen, inputClose: new Date(votingOpen), votingOpen, votingClose };
}

module.exports = {
  combineDateWithTime,
  addRecurrence,
  buildRoundWindow,
};
