'use strict';

/**
 * Pure winner selection. Given the voting method and the round's songs (each
 * carrying its `votes` array), decide the winning song. No DB access — the same
 * function is used by automatic finalization and any manual/admin finalize, so
 * the algorithm exists exactly once.
 *
 * Vote `value` semantics by method:
 *   - single_vote: always 1        → score = number of votes
 *   - top_3:       rank 1..3        → score = sum of (4 - rank) points
 *   - rating:      rating 1..N      → score = average rating (needs >=1 vote)
 */

function voteCount(song) {
  return song.votes ? song.votes.length : 0;
}

function scoreFor(method, song) {
  const votes = song.votes || [];
  switch (method) {
    case 'top_3':
      return votes.reduce((sum, v) => sum + (4 - v.value), 0);
    case 'rating':
      if (votes.length === 0) return 0;
      return votes.reduce((sum, v) => sum + v.value, 0) / votes.length;
    case 'single_vote':
    default:
      return votes.length;
  }
}

/**
 * Deterministic tiebreak: higher score wins; ties broken by earliest createdAt,
 * then lowest id. Songs with no votes can never win (score 0 is rejected).
 *
 * @returns {object|null} the winning song, or null if no votes were cast.
 */
function computeWinner(method, songs) {
  let best = null;
  let bestScore = 0;

  for (const song of songs) {
    if (method === 'rating' && voteCount(song) === 0) continue;
    const score = scoreFor(method, song);
    if (score <= 0) continue;

    if (best === null || score > bestScore) {
      best = song;
      bestScore = score;
      continue;
    }
    if (score === bestScore) {
      const earlier = new Date(song.createdAt) < new Date(best.createdAt);
      const sameTimeLowerId =
        new Date(song.createdAt).getTime() === new Date(best.createdAt).getTime() &&
        song.id < best.id;
      if (earlier || sameTimeLowerId) best = song;
    }
  }

  return best;
}

module.exports = { computeWinner, scoreFor, voteCount };
