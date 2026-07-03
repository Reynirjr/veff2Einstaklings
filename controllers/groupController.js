'use strict';

const { Group, GroupUser, Round, Song, Vote, User } = require('../models');
const { computePhase, PHASE } = require('../domain/phases');
const { scoreFor } = require('../domain/winner');
const roundService = require('../services/roundService');
const groupService = require('../services/groupService');
const scoreService = require('../services/scoreService');

/** GET /groups — list all groups. */
exports.list = async (req, res) => {
  const userId = req.user.id;
  const groups = await Group.findAll({
    include: [
      { model: User, as: 'creator' },
      { model: User, as: 'members', attributes: ['id'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  const processed = groups.map((g) => {
    const plain = g.get({ plain: true });
    plain.isMember = plain.members.some((m) => m.id === userId);
    return plain;
  });

  res.render('groups', { groups: processed, userId, page: 'groups' });
};

/** GET /groups/create */
exports.showCreate = (req, res) => {
  res.render('createGroup');
};

/** POST /groups */
exports.create = async (req, res) => {
  try {
    const group = await groupService.createGroupWithFirstRound(req.user.id, req.body);
    res.flash('success', 'Hópur stofnaður! Þú getur nú bætt við lögum eða boðið meðlimum.');
    res.redirect(`/groups/${group.id}`);
  } catch (err) {
    if (err instanceof groupService.GroupError) {
      res.flash('error', err.message);
      return res.redirect('/groups');
    }
    throw err;
  }
};

/** GET /groups/:id — group detail with current round, leaderboard, results. */
exports.show = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  // Single reconcile point: finalize/advance rounds before rendering.
  await roundService.reconcileGroup(groupId);

  const group = await Group.findByPk(groupId, {
    include: [
      { model: User, as: 'creator' },
      { model: User, as: 'members' },
      {
        model: Round,
        as: 'rounds',
        include: [
          {
            model: Song,
            as: 'songs',
            include: [
              { model: User, as: 'submitter', attributes: ['username'] },
              { model: Vote, as: 'votes' },
            ],
          },
          { model: User, as: 'winner', required: false },
          {
            model: Song,
            as: 'winningSong',
            required: false,
            include: [{ model: User, as: 'submitter', attributes: ['username'] }],
          },
        ],
      },
    ],
  });

  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  const isMember = group.members.some((m) => m.id === userId);

  if (group.passwordHash && !isMember) {
    return res.render('groupJoin', {
      group: {
        id: group.id,
        name: group.name,
        creatorName: group.creator ? group.creator.username : 'Unknown',
      },
    });
  }

  const rounds = [...(group.rounds || [])].sort((a, b) => b.roundNumber - a.roundNumber);
  const currentRound = rounds[0] || null;
  const phase = currentRound ? computePhase(currentRound) : null;

  // The newest round whose results are in. Once a round finishes, reconcile
  // spawns the next one immediately, so `currentRound` is usually the NEW
  // round — the results popup must look at the last finished one instead.
  const lastFinishedRound =
    rounds.find((r) => computePhase(r) === PHASE.FINISHED) || null;

  let userSubmittedSong = null;
  let songsWithVotes = [];
  let hasVotedInRound = false;
  if (currentRound) {
    userSubmittedSong = (currentRound.songs || []).find((s) => s.submittedBy === userId);
    hasVotedInRound = (currentRound.songs || []).some((s) =>
      (s.votes || []).some((v) => v.userId === userId)
    );
    if (phase === PHASE.VOTING || phase === PHASE.FINISHED) {
      // Order by the round's actual voting method (points for top_3, average for
      // rating, count for single_vote) so the display matches the real winner.
      songsWithVotes = (currentRound.songs || [])
        .map((s) => {
          const plain = s.get({ plain: true });
          plain.voteCount = plain.votes ? plain.votes.length : 0;
          plain.score = scoreFor(group.votingMethod, plain);
          return plain;
        })
        .sort((a, b) => b.score - a.score);
    }
  }

  const isAdmin = !!(await GroupUser.findOne({
    where: { groupId, userId, role: 'admin' },
  }));

  const leaderboard = await scoreService.getLeaderboard(groupId);

  let nextRound = null;
  if (currentRound && currentRound.status === PHASE.FINISHED) {
    nextRound = await Round.findOne({
      where: { groupId, roundNumber: currentRound.roundNumber + 1 },
      order: [['inputOpen', 'ASC']],
    });
  }

  const isWinner = !!(lastFinishedRound && lastFinishedRound.winnerId === userId);

  res.render('group', {
    group,
    isMember,
    userId,
    isAdmin,
    currentRound,
    phase,
    userSubmittedSong,
    hasVotedInRound,
    songsWithVotes,
    leaderboard,
    nextRound,
    isWinner,
    lastFinishedRound,
    winningRound: isWinner ? lastFinishedRound : null,
    nextThemeSelected: lastFinishedRound ? !!lastFinishedRound.nextThemeSelected : false,
    page: 'group',
  });
};

/** POST /groups/:id/join */
exports.join = async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  try {
    await groupService.joinGroup(group, req.user.id, req.body.enteredPassword);
    res.redirect(`/groups/${group.id}`);
  } catch (err) {
    if (err instanceof groupService.GroupError) {
      res.flash('error', err.message);
      return res.redirect(`/groups/${group.id}`);
    }
    throw err;
  }
};

/** POST /groups/:id/delete — creator only. */
exports.destroy = async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) return res.status(404).render('error', { message: 'Group not found' });
  if (group.created_by !== req.user.id) {
    res.flash('error', 'You do not have permission to delete this group.');
    return res.redirect(`/groups/${group.id}`);
  }
  await groupService.deleteGroupCascade(group.id);
  res.flash('success', 'Group deleted.');
  res.redirect('/groups');
};

/** GET /groups/:id/admin — admin panel. */
exports.adminPanel = async (req, res) => {
  const group = await Group.findByPk(req.params.id, {
    include: [
      { model: User, as: 'creator' },
      { model: User, as: 'members', through: { attributes: ['role'] } },
      { model: Round, as: 'rounds' },
    ],
  });
  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  res.render('groupAdmin', {
    group,
    userId: req.user.id,
    rounds: group.rounds || [],
    page: 'admin',
  });
};

/** POST /groups/:id/members/:userId/remove — admin only. */
exports.removeMember = async (req, res) => {
  const { id: groupId, userId: targetId } = req.params;
  const group = await Group.findByPk(groupId);
  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  if (Number(targetId) === req.user.id) {
    res.flash('error', 'You cannot remove yourself.');
  } else if (Number(targetId) === group.created_by) {
    res.flash('error', 'You cannot remove the group creator.');
  } else {
    const removed = await GroupUser.destroy({ where: { groupId, userId: targetId } });
    res.flash(removed ? 'success' : 'error', removed ? 'Member removed.' : 'Member not found.');
  }
  res.redirect(`/groups/${groupId}/admin`);
};
