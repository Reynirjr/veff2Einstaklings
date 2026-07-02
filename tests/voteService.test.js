'use strict';

// Mock the DB layer so castVote's rules can be tested without Postgres.
const created = [];
const destroyed = [];

jest.mock('../config/database', () => ({
  transaction: async (fn) => fn('TX'),
  QueryTypes: { SELECT: 'SELECT' },
}));

jest.mock('../models', () => ({
  Song: { findAll: jest.fn(async () => [{ id: 10 }, { id: 11 }, { id: 12 }]) },
  Vote: {
    destroy: jest.fn(async (args) => {
      destroyed.push(args);
    }),
    create: jest.fn(async (values) => {
      created.push(values);
      return values;
    }),
  },
  User: {},
}));

const { castVote, VoteError } = require('../services/voteService');

const song = { id: 11, roundId: 5, submittedBy: 99 };

beforeEach(() => {
  created.length = 0;
  destroyed.length = 0;
});

describe('castVote guards', () => {
  test('rejects voting for your own song', async () => {
    await expect(
      castVote({ userId: 99, song, method: 'single_vote' })
    ).rejects.toBeInstanceOf(VoteError);
  });

  test('rejects a song with no round', async () => {
    await expect(
      castVote({ userId: 1, song: { id: 1, roundId: null, submittedBy: 2 }, method: 'single_vote' })
    ).rejects.toBeInstanceOf(VoteError);
  });

  test('rejects an out-of-range top_3 rank', async () => {
    await expect(
      castVote({ userId: 1, song, method: 'top_3', value: 4 })
    ).rejects.toBeInstanceOf(VoteError);
  });

  test('rejects an out-of-range rating', async () => {
    await expect(
      castVote({ userId: 1, song, method: 'rating', value: 11 })
    ).rejects.toBeInstanceOf(VoteError);
  });

  test('accepts a rating up to 10', async () => {
    await castVote({ userId: 1, song, method: 'rating', value: 10 });
    expect(created[0]).toEqual({ userId: 1, songId: 11, value: 10 });
  });
});

describe('castVote records the right value', () => {
  test('single_vote clears the round then stores value 1', async () => {
    await castVote({ userId: 1, song, method: 'single_vote' });
    expect(created[0]).toEqual({ userId: 1, songId: 11, value: 1 });
    expect(destroyed).toHaveLength(1);
  });

  test('top_3 stores the rank', async () => {
    await castVote({ userId: 1, song, method: 'top_3', value: 2 });
    expect(created[0]).toEqual({ userId: 1, songId: 11, value: 2 });
  });

  test('rating stores the rating', async () => {
    await castVote({ userId: 1, song, method: 'rating', value: 5 });
    expect(created[0]).toEqual({ userId: 1, songId: 11, value: 5 });
  });
});
