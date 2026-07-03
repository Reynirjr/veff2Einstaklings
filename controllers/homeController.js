'use strict';

const { Op } = require('sequelize');
const { User, Group, Round, Song, Vote } = require('../models');
const { computePhase, PHASE } = require('../domain/phases');

/**
 * Sort order for the dashboard: the phases that need the user's action first.
 */
const PHASE_PRIORITY = {
  [PHASE.VOTING]: 0,
  [PHASE.INPUT]: 1,
  [PHASE.PENDING]: 2,
  [PHASE.FINISHED]: 3,
};

/**
 * GET / — logged-out visitors get the welcome hero; logged-in users get a
 * dashboard of their groups with each group's current phase and what (if
 * anything) they still need to do there.
 */
exports.home = async (req, res) => {
  if (!req.user) {
    return res.render('index', { cards: null, page: 'home' });
  }

  const user = await User.findByPk(req.user.id, {
    include: [{ model: Group, as: 'joinedGroups' }],
  });
  const groups = user ? user.joinedGroups : [];

  if (groups.length === 0) {
    return res.render('index', { cards: [], page: 'home' });
  }

  // Latest round per group (one query for all groups).
  const rounds = await Round.findAll({
    where: { groupId: { [Op.in]: groups.map((g) => g.id) } },
    order: [['roundNumber', 'DESC']],
  });
  const latestRound = {};
  for (const round of rounds) {
    if (!latestRound[round.groupId]) latestRound[round.groupId] = round;
  }

  // The user's submissions and votes within those rounds (two queries total).
  const roundIds = Object.values(latestRound).map((r) => r.id);
  const roundSongs = roundIds.length
    ? await Song.findAll({
        where: { roundId: { [Op.in]: roundIds } },
        attributes: ['id', 'roundId', 'submittedBy'],
      })
    : [];
  const myVotes = roundSongs.length
    ? await Vote.findAll({
        where: {
          userId: req.user.id,
          songId: { [Op.in]: roundSongs.map((s) => s.id) },
        },
        attributes: ['songId'],
      })
    : [];
  const votedSongIds = new Set(myVotes.map((v) => v.songId));

  const cards = groups
    .map((group) => {
      const round = latestRound[group.id] || null;
      const phase = round ? computePhase(round) : null;
      const songsInRound = round ? roundSongs.filter((s) => s.roundId === round.id) : [];

      const hasSubmitted = songsInRound.some((s) => s.submittedBy === req.user.id);
      const hasVoted = songsInRound.some((s) => votedSongIds.has(s.id));

      // The next deadline the user cares about in this group.
      let deadline = null;
      if (round) {
        if (phase === PHASE.PENDING) deadline = round.inputOpen;
        else if (phase === PHASE.INPUT) deadline = round.inputClose;
        else if (phase === PHASE.VOTING) deadline = round.votingClose;
      }

      // Does this card need the user to DO something right now?
      const needsAction =
        (phase === PHASE.INPUT && !hasSubmitted) || (phase === PHASE.VOTING && !hasVoted);

      return {
        group: group.get({ plain: true }),
        round: round ? round.get({ plain: true }) : null,
        phase,
        deadline,
        hasSubmitted,
        hasVoted,
        needsAction,
      };
    })
    .sort((a, b) => {
      const pa = a.phase ? PHASE_PRIORITY[a.phase] : 4;
      const pb = b.phase ? PHASE_PRIORITY[b.phase] : 4;
      if (pa !== pb) return pa - pb;
      // Within the same phase, the tighter deadline first.
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });

  res.render('index', { cards, page: 'home' });
};
