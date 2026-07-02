'use strict';

const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const { Song, User, Group, Vote, Round } = require('../models');
const { computePhase, PHASE } = require('../domain/phases');
const voteService = require('../services/voteService');

const YT_PATTERNS = [
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
  /(?:youtu\.be\/)([^"&?/\s]{11})/,
];

function extractYouTubeId(url) {
  if (!url) return '';
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return '';
}

/** POST /rounds/:roundId/songs — submit one song for the round's input phase. */
exports.submitSong = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    res.flash('error', 'Please provide a valid title and artist.');
    return res.redirect('back');
  }

  const { roundId } = req.params;
  const userId = req.user.id;
  const round = await Round.findByPk(roundId);
  if (!round) return res.status(404).render('error', { message: 'Round not found' });

  if (computePhase(round) !== PHASE.INPUT) {
    res.flash('error', 'Song submission is not open for this round.');
    return res.redirect(`/groups/${round.groupId}`);
  }

  const existing = await Song.findOne({ where: { roundId, submittedBy: userId } });
  if (existing) {
    res.flash('error', 'You have already added a song this round.');
    return res.redirect(`/groups/${round.groupId}`);
  }

  const { title, artist, youtubeUrl } = req.body;
  await Song.create({
    title,
    artist,
    youtubeUrl,
    roundId,
    groupId: round.groupId,
    submittedBy: userId,
  });
  res.redirect(`/groups/${round.groupId}`);
};

/** POST /songs/:id/vote — cast a vote (single_vote / top_3 / rating). */
exports.submitVote = async (req, res) => {
  const userId = req.user.id;
  const song = await Song.findByPk(req.params.id, {
    include: [{ model: Group, as: 'group' }],
  });
  if (!song) return res.status(404).render('error', { message: 'Song not found' });

  const round = await Round.findByPk(song.roundId);
  const redirectTo = safeReturn(req.body.returnTo, `/groups/${song.groupId}/voting`);

  if (!round || computePhase(round) !== PHASE.VOTING) {
    res.flash('error', 'Voting is not open for this round.');
    return res.redirect(redirectTo);
  }

  const method = song.group.votingMethod;
  const value = method === 'rating' ? req.body.rating : method === 'top_3' ? req.body.rank : undefined;

  try {
    await voteService.castVote({ userId, song, method, value });
  } catch (err) {
    if (err instanceof voteService.VoteError) {
      res.flash('error', err.message);
      return res.redirect(redirectTo);
    }
    throw err;
  }
  res.redirect(redirectTo);
};

/** GET /songs/:id — song detail with the embedded video + voting controls. */
exports.getSongDetail = async (req, res) => {
  const songId = req.params.id;
  const userId = req.user ? req.user.id : null;

  const song = await Song.findByPk(songId, {
    include: [
      { model: User, as: 'submitter' },
      { model: Group, as: 'group', attributes: ['id', 'name', 'votingMethod', 'theme'] },
    ],
  });
  if (!song) return res.status(404).render('error', { message: 'Song not found' });

  const group = song.group;
  const round = song.roundId ? await Round.findByPk(song.roundId) : null;
  const phase = round ? computePhase(round) : PHASE.PENDING;
  const canVote = !!userId && song.submittedBy !== userId && phase === PHASE.VOTING;

  // Current user's vote value on this song (numeric) and, for top_3, which
  // ranks are still free.
  let userVote = null;
  let availableRanks = [1, 2, 3];
  if (userId) {
    const existing = await Vote.findOne({ where: { songId: song.id, userId } });
    userVote = existing ? existing.value : null;

    if (group.votingMethod === 'top_3' && song.roundId) {
      const roundSongIds = (
        await Song.findAll({ where: { roundId: song.roundId }, attributes: ['id'] })
      ).map((s) => s.id);
      const userVotes = await Vote.findAll({
        where: { userId, songId: { [Op.in]: roundSongIds } },
      });
      availableRanks = [1, 2, 3].filter(
        (rank) => !userVotes.some((v) => v.value === rank && v.songId !== Number(song.id))
      );
    }
  }

  // Track viewed songs in a cookie (for the "watched" badge on the voting grid).
  if (userId) {
    const viewed = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
    if (!viewed.includes(songId)) {
      viewed.push(songId);
      res.cookie('viewedSongs', JSON.stringify(viewed), {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
    }
  }

  const roundSongs = await Song.findAll({
    where: {
      roundId: song.roundId,
      ...(userId ? { submittedBy: { [Op.ne]: userId } } : {}),
    },
    order: [['id', 'ASC']],
    attributes: ['id', 'title'],
  });
  const idx = roundSongs.findIndex((s) => s.id === song.id);

  res.render('song', {
    song,
    group,
    youtubeVideoId: extractYouTubeId(song.youtubeUrl),
    userId,
    canVote,
    userVote,
    phase,
    availableRanks,
    prevSong: idx > 0 ? roundSongs[idx - 1] : null,
    nextSong: idx >= 0 && idx < roundSongs.length - 1 ? roundSongs[idx + 1] : null,
    isVotingPhase: phase === PHASE.VOTING,
  });
};

/** GET /groups/:groupId/voting — the voting grid for the current round. */
exports.getGroupVoting = async (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.id;

  const group = await Group.findByPk(groupId);
  if (!group) return res.status(404).render('error', { message: 'Group not found' });

  const currentRound = await Round.findOne({
    where: { groupId },
    order: [['roundNumber', 'DESC']],
  });

  const songs = currentRound
    ? await Song.findAll({
        where: { roundId: currentRound.id, submittedBy: { [Op.ne]: userId } },
        include: [{ model: User, as: 'submitter' }],
      })
    : [];

  const userVotes = {};
  if (songs.length > 0) {
    const votes = await Vote.findAll({
      where: { userId, songId: { [Op.in]: songs.map((s) => s.id) } },
    });
    votes.forEach((v) => {
      userVotes[v.songId] = v.value;
    });
  }

  const viewed = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
  const processed = songs.map((s) => {
    const plain = s.get({ plain: true });
    plain.isWatched = viewed.includes(String(s.id));
    plain.userVote = userVotes[s.id] !== undefined ? userVotes[s.id] : null;
    return plain;
  });

  res.render('voting', {
    group,
    songs: processed,
    currentRound: currentRound || {},
    votingMethod: group.votingMethod || 'single_vote',
    phase: currentRound ? computePhase(currentRound) : PHASE.PENDING,
    page: 'voting',
  });
};

function safeReturn(returnTo, fallback) {
  if (returnTo && returnTo.startsWith('/')) return returnTo;
  return fallback;
}
