'use strict';

const { PHASE, computePhase } = require('../domain/phases');

// A round: input 08:00–12:00, voting 12:00–16:00 on 2026-01-01.
const round = {
  inputOpen: '2026-01-01T08:00:00',
  inputClose: '2026-01-01T12:00:00',
  votingOpen: '2026-01-01T12:00:00',
  votingClose: '2026-01-01T16:00:00',
};

const at = (iso) => new Date(iso);

describe('computePhase', () => {
  test('before inputOpen → pending', () => {
    expect(computePhase(round, at('2026-01-01T07:59:00'))).toBe(PHASE.PENDING);
  });

  test('during input window → input', () => {
    expect(computePhase(round, at('2026-01-01T09:00:00'))).toBe(PHASE.INPUT);
  });

  test('inputOpen boundary is inclusive → input', () => {
    expect(computePhase(round, at('2026-01-01T08:00:00'))).toBe(PHASE.INPUT);
  });

  test('during voting window → voting', () => {
    expect(computePhase(round, at('2026-01-01T14:00:00'))).toBe(PHASE.VOTING);
  });

  test('after votingClose → finished', () => {
    expect(computePhase(round, at('2026-01-01T16:00:01'))).toBe(PHASE.FINISHED);
  });

  test('handles a round whose voting wraps past midnight', () => {
    const nightRound = {
      inputOpen: '2026-01-01T20:00:00',
      inputClose: '2026-01-01T23:00:00',
      votingOpen: '2026-01-01T23:00:00',
      votingClose: '2026-01-02T02:00:00',
    };
    expect(computePhase(nightRound, at('2026-01-02T01:00:00'))).toBe(PHASE.VOTING);
    expect(computePhase(nightRound, at('2026-01-02T03:00:00'))).toBe(PHASE.FINISHED);
  });
});
