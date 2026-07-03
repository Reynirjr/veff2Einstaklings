'use strict';

const sequelize = require('../config/database');
const { Group, Round, Song, Vote, User } = require('../models');
const { PHASE, computePhase } = require('../domain/phases');
const { buildRoundWindow, addRecurrence, combineDateWithTime } = require('../domain/time');
const { computeWinner } = require('../domain/winner');
const scoreService = require('./scoreService');
const pushService = require('./pushService');

/**
 * The single owner of the round lifecycle. Everything that used to finalize a
 * round in four different places (a 60s checker, two middlewares and an inline
 * route block) now goes through here.
 */

/**
 * Finalize a round: pick the winner, mark it finished, and award the point.
 * Idempotent — a round already finished with a winner is left untouched.
 */
async function finalizeRound(round, group = null) {
  if (round.status === PHASE.FINISHED && round.winningSongId) return round;

  // Only the FIRST finalization notifies members. A no-votes round keeps
  // status=finished with no winningSongId, so it re-enters here on every
  // reconcile — without this flag it would notify every 60 seconds.
  const isFirstFinalize = round.status !== PHASE.FINISHED;

  const grp = group || (await Group.findByPk(round.groupId));
  if (!grp) return round;

  const songs = await Song.findAll({
    where: { roundId: round.id },
    include: [
      { model: User, as: 'submitter' },
      { model: Vote, as: 'votes' },
    ],
  });

  const winner = computeWinner(grp.votingMethod, songs.map((s) => s.get({ plain: true })));

  // Persist the result and award the point atomically: if awardWin fails, the
  // round is NOT left marked finished (the idempotency guard would otherwise
  // skip the retry and the winner's point would be lost forever).
  await sequelize.transaction(async (transaction) => {
    round.status = PHASE.FINISHED;
    round.winnerId = winner ? winner.submittedBy : null;
    round.winningSongId = winner ? winner.id : null;
    await round.save({ transaction });
    if (winner) {
      await scoreService.awardWin(winner.submittedBy, grp.id, { transaction });
    }
  });

  if (isFirstFinalize && winner) {
    await pushService.notifyGroupMembers(grp.id, {
      title: `🏆 Niðurstöður komnar — ${grp.name}`,
      body: `Umferð #${round.roundNumber} er lokið. Sjáðu hver vann!`,
      url: `/groups/${grp.id}`,
      tag: `results-${round.id}`,
    });
  }
  return round;
}

/**
 * Create the first round for a group.
 * @param {object} group
 * @param {Date} [startDate] the day the round runs on (defaults to today)
 * @param {Date} [now] the clock used to derive the initial status
 */
async function createFirstRound(group, startDate = new Date(), now = new Date(), options = {}) {
  const window = buildRoundWindow(startDate, group);
  const status = computePhase(window, now);
  return Round.create(
    {
      groupId: group.id,
      roundNumber: 1,
      theme: group.theme,
      ...window,
      status: status === PHASE.FINISHED ? PHASE.PENDING : status,
    },
    { transaction: options.transaction }
  );
}

/** Create the next round after a finished one, per the group's recurrence. */
async function createNextRound(finishedRound, group = null) {
  const grp = group || (await Group.findByPk(finishedRound.groupId));
  if (!grp || grp.votingRecurrence === 'none') return null;

  const nextStart = addRecurrence(finishedRound.inputOpen, grp.votingRecurrence);
  if (!nextStart) return null;

  const window = buildRoundWindow(nextStart, grp);
  // Preserve the original input-open time of day (buildRoundWindow uses the
  // group's configured times, which is what we want for a recurring schedule).
  window.inputOpen = combineDateWithTime(nextStart, grp.inputOpenTime);

  return Round.create({
    groupId: grp.id,
    roundNumber: finishedRound.roundNumber + 1,
    theme: grp.theme,
    ...window,
    status: PHASE.PENDING,
  });
}

/**
 * Bring a single group's rounds up to date: advance/finish the current round
 * and, for recurring groups, make sure the next round exists.
 */
async function reconcileGroup(groupOrId, now = new Date()) {
  const group =
    typeof groupOrId === 'object' ? groupOrId : await Group.findByPk(groupOrId);
  if (!group) return;

  const rounds = await Round.findAll({
    where: { groupId: group.id },
    order: [['roundNumber', 'ASC']],
  });

  if (rounds.length === 0) {
    await createFirstRound(group, now);
    return;
  }

  for (const round of rounds) {
    if (round.status === PHASE.FINISHED) continue;
    const phase = computePhase(round, now);
    if (phase === PHASE.FINISHED) {
      await finalizeRound(round, group);
    } else if (round.status !== phase) {
      round.status = phase;
      await round.save();

      // The status cache advances exactly once per transition, so this is the
      // one safe place to announce it.
      if (phase === PHASE.INPUT) {
        await pushService.notifyGroupMembers(group.id, {
          title: `🎵 Innsendingar opnar — ${group.name}`,
          body: round.theme
            ? `Þema umferðar #${round.roundNumber}: ${round.theme}. Sendu inn lag!`
            : `Umferð #${round.roundNumber} er hafin. Sendu inn lag!`,
          url: `/groups/${group.id}`,
          tag: `input-${round.id}`,
        });
      } else if (phase === PHASE.VOTING) {
        await pushService.notifyGroupMembers(group.id, {
          title: `🗳️ Kosning hafin — ${group.name}`,
          body: `Hlustaðu á lögin í umferð #${round.roundNumber} og kjóstu!`,
          url: `/groups/${group.id}/voting`,
          tag: `voting-${round.id}`,
        });
      }
    }
  }

  const latest = rounds[rounds.length - 1];
  if (latest.status === PHASE.FINISHED && group.votingRecurrence !== 'none') {
    const next = await Round.findOne({
      where: { groupId: group.id, roundNumber: latest.roundNumber + 1 },
    });
    if (!next) await createNextRound(latest, group);
  }
}

/** Reconcile every group. Run periodically by jobs/roundJob. */
async function reconcile(now = new Date()) {
  const groups = await Group.findAll();
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop
    await reconcileGroup(group, now);
  }
}

module.exports = {
  finalizeRound,
  createFirstRound,
  createNextRound,
  reconcileGroup,
  reconcile,
};
