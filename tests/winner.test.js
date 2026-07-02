'use strict';

const { computeWinner } = require('../domain/winner');

const song = (id, createdAt, votes) => ({ id, createdAt, votes });
const v = (value) => ({ value });

describe('computeWinner — single_vote', () => {
  test('song with the most votes wins', () => {
    const songs = [
      song(1, '2026-01-01T00:00:00', [v(1), v(1)]),
      song(2, '2026-01-01T00:00:00', [v(1), v(1), v(1)]),
    ];
    expect(computeWinner('single_vote', songs).id).toBe(2);
  });

  test('no votes at all → no winner', () => {
    const songs = [song(1, '2026-01-01T00:00:00', []), song(2, '2026-01-01T00:00:00', [])];
    expect(computeWinner('single_vote', songs)).toBeNull();
  });
});

describe('computeWinner — top_3 (points = 4 - rank)', () => {
  test('highest points wins', () => {
    const songs = [
      // 3 + 1 = 4 points
      song(1, '2026-01-01T00:00:00', [v(1), v(3)]),
      // 2 + 2 = 4 points but... equal — tiebreak applies (see below)
      song(2, '2026-01-01T00:00:01', [v(2), v(2)]),
      // 3 points
      song(3, '2026-01-01T00:00:00', [v(1)]),
    ];
    // songs 1 and 2 tie at 4; song 1 is earlier → wins
    expect(computeWinner('top_3', songs).id).toBe(1);
  });
});

describe('computeWinner — rating (highest average, needs a vote)', () => {
  test('highest average wins even with fewer votes', () => {
    const songs = [
      song(1, '2026-01-01T00:00:00', [v(5)]), // avg 5
      song(2, '2026-01-01T00:00:00', [v(4), v(4)]), // avg 4
    ];
    expect(computeWinner('rating', songs).id).toBe(1);
  });

  test('a song with no votes cannot win', () => {
    const songs = [song(1, '2026-01-01T00:00:00', []), song(2, '2026-01-01T00:00:00', [v(1)])];
    expect(computeWinner('rating', songs).id).toBe(2);
  });
});

describe('computeWinner — deterministic tiebreak', () => {
  test('equal score → earliest createdAt wins', () => {
    const songs = [
      song(2, '2026-01-01T10:00:00', [v(1)]),
      song(1, '2026-01-01T09:00:00', [v(1)]),
    ];
    expect(computeWinner('single_vote', songs).id).toBe(1);
  });

  test('equal score and time → lowest id wins', () => {
    const songs = [
      song(9, '2026-01-01T09:00:00', [v(1)]),
      song(4, '2026-01-01T09:00:00', [v(1)]),
    ];
    expect(computeWinner('single_vote', songs).id).toBe(4);
  });
});
