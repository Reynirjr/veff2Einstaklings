'use strict';

const {
  combineDateWithTime,
  addRecurrence,
  buildRoundWindow,
} = require('../domain/time');

describe('combineDateWithTime', () => {
  test('sets the time of day on the given date', () => {
    const d = combineDateWithTime(new Date('2026-03-10T05:30:00'), '08:15:00');
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(15);
    expect(d.getSeconds()).toBe(0);
    expect(d.getDate()).toBe(10);
  });

  test('accepts HH:MM without seconds', () => {
    const d = combineDateWithTime(new Date('2026-03-10T00:00:00'), '23:45');
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(45);
  });
});

describe('addRecurrence', () => {
  const base = new Date('2026-01-01T08:00:00');
  test('daily adds one day', () => {
    expect(addRecurrence(base, 'daily').getDate()).toBe(2);
  });
  test('weekly adds seven days', () => {
    expect(addRecurrence(base, 'weekly').getDate()).toBe(8);
  });
  test('biweekly adds fourteen days', () => {
    expect(addRecurrence(base, 'biweekly').getDate()).toBe(15);
  });
  test('monthly advances the month', () => {
    expect(addRecurrence(base, 'monthly').getMonth()).toBe(1);
  });
  test('none returns null', () => {
    expect(addRecurrence(base, 'none')).toBeNull();
  });
});

describe('buildRoundWindow', () => {
  const group = {
    inputOpenTime: '00:00:00',
    votingOpenTime: '08:00:00',
    votingCloseTime: '12:00:00',
  };
  test('inputClose collapses onto votingOpen', () => {
    const w = buildRoundWindow(new Date('2026-05-01T00:00:00'), group);
    expect(w.inputClose.getTime()).toBe(w.votingOpen.getTime());
    expect(w.votingOpen.getHours()).toBe(8);
    expect(w.votingClose.getHours()).toBe(12);
  });
  test('votingClose rolls to next day when before votingOpen', () => {
    const nightGroup = {
      inputOpenTime: '20:00:00',
      votingOpenTime: '23:00:00',
      votingCloseTime: '02:00:00',
    };
    const w = buildRoundWindow(new Date('2026-05-01T00:00:00'), nightGroup);
    expect(w.votingClose.getDate()).toBe(2);
  });

  test('inputClose is a distinct Date instance from votingOpen', () => {
    const w = buildRoundWindow(new Date('2026-05-01T00:00:00'), {
      inputOpenTime: '00:00:00',
      votingOpenTime: '08:00:00',
      votingCloseTime: '12:00:00',
    });
    expect(w.inputClose).not.toBe(w.votingOpen);
    expect(w.inputClose.getTime()).toBe(w.votingOpen.getTime());
  });
});

describe('addRecurrence monthly clamps day overflow', () => {
  test('Jan 31 monthly → Feb 28 (not Mar)', () => {
    const d = addRecurrence(new Date('2026-01-31T08:00:00'), 'monthly');
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(28); // 2026 is not a leap year
  });
});
