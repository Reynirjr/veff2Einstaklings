'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Song, Vote, User } = require('../models');
const { scoreFor, voteCount } = require('../domain/winner');

/**
 * Voting — records a vote for any of the three methods and reads round results.
 * This is the only place that writes to `Votes`, so the (previously missing)
 * top_3 and rating capture live here alongside single_vote.
 */

class VoteError extends Error {}

const RANK_RANGE = [1, 2, 3];
const RATING_MIN = 1;
const RATING_MAX = 10; // matches the 1–10 scale offered in the views

async function songIdsInRound(roundId, transaction) {
  const songs = await Song.findAll({
    where: { roundId },
    attributes: ['id'],
    transaction,
  });
  return songs.map((s) => s.id);
}

/**
 * Cast a vote.
 *
 * @param {object} args
 * @param {number} args.userId
 * @param {object} args.song   a Song instance (needs id, roundId, submittedBy)
 * @param {'single_vote'|'top_3'|'rating'} args.method
 * @param {number} [args.value] rank (top_3) or rating (rating); ignored for single_vote
 */
async function castVote({ userId, song, method, value }) {
  if (!song.roundId) {
    throw new VoteError('This song is not part of a votable round.');
  }
  if (song.submittedBy === userId) {
    throw new VoteError('You cannot vote for your own song.');
  }

  return sequelize.transaction(async (transaction) => {
    const roundSongIds = await songIdsInRound(song.roundId, transaction);

    if (method === 'top_3') {
      const rank = Number(value);
      if (!RANK_RANGE.includes(rank)) {
        throw new VoteError('Rank must be 1, 2 or 3.');
      }
      // Replace this user's vote on this song, and free the rank if it was
      // already assigned to a different song in the round.
      await Vote.destroy({
        where: {
          userId,
          songId: { [Op.in]: roundSongIds },
          [Op.or]: [{ songId: song.id }, { value: rank }],
        },
        transaction,
      });
      return Vote.create({ userId, songId: song.id, value: rank }, { transaction });
    }

    if (method === 'rating') {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
        throw new VoteError(`Rating must be between ${RATING_MIN} and ${RATING_MAX}.`);
      }
      await Vote.destroy({ where: { userId, songId: song.id }, transaction });
      return Vote.create({ userId, songId: song.id, value: rating }, { transaction });
    }

    // single_vote: one pick per round.
    await Vote.destroy({
      where: { userId, songId: { [Op.in]: roundSongIds } },
      transaction,
    });
    return Vote.create({ userId, songId: song.id, value: 1 }, { transaction });
  });
}

/**
 * Songs of a round with their computed standing for the given voting method,
 * sorted best-first. Includes the current user's own vote value per song.
 */
async function getRoundResults(roundId, method, userId = null) {
  const songs = await Song.findAll({
    where: { roundId },
    include: [
      { model: User, as: 'submitter', attributes: ['id', 'username'] },
      { model: Vote, as: 'votes' },
    ],
  });

  const results = songs.map((song) => {
    const plain = song.get({ plain: true });
    const userVote = userId
      ? (plain.votes.find((v) => v.userId === userId) || null)
      : null;
    return {
      ...plain,
      voteCount: voteCount(plain),
      score: scoreFor(method, plain),
      userVoteValue: userVote ? userVote.value : null,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { castVote, getRoundResults, VoteError };
