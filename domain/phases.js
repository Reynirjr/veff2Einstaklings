'use strict';

/**
 * The single source of truth for a round's phase.
 *
 * A round moves through four time-bounded phases. Rather than trusting the
 * cached `status` column (which only a background job advances), the UI derives
 * the phase from the round's timestamps and the current time. Every route,
 * controller and view uses `computePhase` so they can never disagree.
 */

const PHASE = Object.freeze({
  PENDING: 'pending', // before submissions open
  INPUT: 'input', // members submit songs
  VOTING: 'voting', // members vote
  FINISHED: 'finished', // voting closed, winner decided
});

/**
 * @param {{inputOpen: Date|string, inputClose: Date|string,
 *          votingOpen: Date|string, votingClose: Date|string}} round
 * @param {Date} [now]
 * @returns {'pending'|'input'|'voting'|'finished'}
 */
function computePhase(round, now = new Date()) {
  const t = now.getTime();
  const inputOpen = new Date(round.inputOpen).getTime();
  const inputClose = new Date(round.inputClose).getTime();
  const votingOpen = new Date(round.votingOpen).getTime();
  const votingClose = new Date(round.votingClose).getTime();

  if (t < inputOpen) return PHASE.PENDING;
  if (t >= inputOpen && t <= inputClose) return PHASE.INPUT;
  if (t >= votingOpen && t <= votingClose) return PHASE.VOTING;
  if (t > votingClose) return PHASE.FINISHED;
  // In the gap between inputClose and votingOpen (if any), treat as pending-for-voting.
  return PHASE.INPUT;
}

module.exports = { PHASE, computePhase };
