import { formatDateISO, getPreviousDay } from './date';

describe('formatDateISO', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 8, 23, 30); // 2026-10-08 local time
    expect(formatDateISO(d)).toBe('2026-10-08');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5);
    expect(formatDateISO(d)).toBe('2026-01-05');
  });
});

describe('getPreviousDay', () => {
  it('returns the calendar day before the given date', () => {
    const d = new Date(2026, 9, 8, 9, 0);
    const prev = getPreviousDay(d);
    expect(formatDateISO(prev)).toBe('2026-10-07');
  });

  it('rolls over a month boundary', () => {
    const d = new Date(2026, 9, 1, 0, 0);
    const prev = getPreviousDay(d);
    expect(formatDateISO(prev)).toBe('2026-09-30');
  });
});
