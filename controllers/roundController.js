'use strict';

const { Round, Group, GroupUser, Song } = require('../models');
const { computePhase, PHASE } = require('../domain/phases');
const roundService = require('../services/roundService');
const themeService = require('../services/themeService');
const voteService = require('../services/voteService');

/** GET /rounds/:roundId — standalone round view. */
exports.show = async (req, res) => {
  const { roundId } = req.params;
  const userId = req.user.id;

  const round = await Round.findByPk(roundId, { include: [{ model: Group, as: 'group' }] });
  if (!round) return res.status(404).render('error', { message: 'Round not found' });

  const isMember = await GroupUser.findOne({ where: { groupId: round.groupId, userId } });
  if (!isMember) return res.status(403).render('error', { message: 'You are not a member of this group' });

  const phase = computePhase(round);

  // Always resolve the user's own submission so the input-phase "already
  // submitted" state renders correctly (not just during voting/finished).
  const userSubmittedSong = await Song.findOne({
    where: { roundId: round.id, submittedBy: userId },
  });

  let songsWithVotes = [];
  if (phase === PHASE.VOTING || phase === PHASE.FINISHED) {
    const results = await voteService.getRoundResults(round.id, round.group.votingMethod, userId);
    songsWithVotes = results.map((s) => ({ ...s, userHasVoted: s.userVoteValue !== null }));
  }

  res.render('round', { round, phase, userSubmittedSong, userId, songsWithVotes });
};

/** POST /groups/:id/rounds — admin creates the next (or first) round. */
exports.createRound = async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  const latest = await Round.findOne({
    where: { groupId: group.id },
    order: [['roundNumber', 'DESC']],
  });

  const created = latest
    ? await roundService.createNextRound(latest, group)
    : await roundService.createFirstRound(group);

  res.flash(
    created ? 'success' : 'error',
    created ? 'New round created.' : 'Could not create a round (group is set to run once).'
  );
  res.redirect(`/groups/${group.id}`);
};

/** POST /groups/:id/theme — the round winner sets the next theme. */
exports.setNextTheme = async (req, res) => {
  const { roundId, themeOption, theme } = req.body;
  const round = await Round.findByPk(roundId);
  if (!round) return res.redirect(`/groups/${req.params.id}`);

  try {
    const chosen = await themeService.setNextTheme(round, req.user.id, { themeOption, theme });
    res.flash('success', `Þema næstu umferðar verður: ${chosen}`);
  } catch (err) {
    if (err instanceof themeService.ThemeError) {
      res.flash('error', err.message);
    } else {
      throw err;
    }
  }
  res.redirect(`/groups/${req.params.id}`);
};
