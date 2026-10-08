import { getLastNightSleepMinutes } from './sleep';

const mockRequestAuthorization = jest.fn();
const mockQueryCategorySamples = jest.fn();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
  queryCategorySamples: (...args: unknown[]) => mockQueryCategorySamples(...args),
}));

// Mirrors @kingstinct/react-native-healthkit's CategoryValueSleepAnalysis enum values.
const INBED = 0;
const ASLEEP_UNSPECIFIED = 1;
const ASLEEP_CORE = 3;
const ASLEEP_DEEP = 4;

describe('getLastNightSleepMinutes', () => {
  beforeEach(() => {
    mockRequestAuthorization.mockReset();
    mockQueryCategorySamples.mockReset();
  });

  it('sums asleep sample durations, excluding inBed samples', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockResolvedValue([
      { value: INBED, startDate: new Date('2026-10-07T22:00:00.000Z'), endDate: new Date('2026-10-08T06:00:00.000Z') },
      { value: ASLEEP_CORE, startDate: new Date('2026-10-07T22:30:00.000Z'), endDate: new Date('2026-10-08T01:00:00.000Z') },
      { value: ASLEEP_DEEP, startDate: new Date('2026-10-08T01:00:00.000Z'), endDate: new Date('2026-10-08T05:30:00.000Z') },
    ]);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBe(420); // 2.5h + 4.5h = 7h = 420min
  });

  it('merges overlapping asleep samples (multiple sources / unspecified over stages) instead of double-counting', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockResolvedValue([
      // Watch stages: 22:30-01:00 core, 01:00-05:30 deep (7h total)
      { value: ASLEEP_CORE, startDate: new Date('2026-10-07T22:30:00.000Z'), endDate: new Date('2026-10-08T01:00:00.000Z') },
      { value: ASLEEP_DEEP, startDate: new Date('2026-10-08T01:00:00.000Z'), endDate: new Date('2026-10-08T05:30:00.000Z') },
      // iPhone: asleepUnspecified 22:00-05:00 overlaps the stages, extends start by 30min
      { value: ASLEEP_UNSPECIFIED, startDate: new Date('2026-10-07T22:00:00.000Z'), endDate: new Date('2026-10-08T05:00:00.000Z') },
      // Separate later nap-like segment 06:00-06:30, not overlapping
      { value: ASLEEP_CORE, startDate: new Date('2026-10-08T06:00:00.000Z'), endDate: new Date('2026-10-08T06:30:00.000Z') },
    ]);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    // Union: 22:00-05:30 (7.5h = 450min) + 06:00-06:30 (30min) = 480min
    expect(result).toBe(480);
  });

  it('returns null when authorization is denied', async () => {
    mockRequestAuthorization.mockResolvedValue(false);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
    expect(mockQueryCategorySamples).not.toHaveBeenCalled();
  });

  it('returns null when there are no sleep samples', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockResolvedValue([]);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
  });

  it('returns null when the query throws', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockRejectedValue(new Error('HealthKit unavailable'));

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
  });
});
