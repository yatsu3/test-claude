import { requestAuthorization, queryCategorySamples } from '@kingstinct/react-native-healthkit';
import { getPreviousDay } from '../lib/date';

const SLEEP_ANALYSIS_IDENTIFIER = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

// CategoryValueSleepAnalysis enum values that represent actual sleep
// (excludes inBed = 0 and awake = 2).
const ASLEEP_VALUES = new Set<number>([1, 3, 4, 5]); // asleepUnspecified/asleep, asleepCore, asleepDeep, asleepREM

type SleepCategorySample = {
  readonly value: number;
  readonly startDate: Date;
  readonly endDate: Date;
};

// Total length of the union of the samples' time ranges. Samples from multiple sources
// (e.g. iPhone + Watch) or asleepUnspecified overlapping core/deep/REM must not be double-counted.
function mergedDurationMs(samples: readonly SleepCategorySample[]): number {
  const intervals = samples
    .map((s) => [s.startDate.getTime(), s.endDate.getTime()] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let curStart: number | null = null;
  let curEnd = 0;
  for (const [start, end] of intervals) {
    if (curStart === null || start > curEnd) {
      if (curStart !== null) {
        total += curEnd - curStart;
      }
      curStart = start;
      curEnd = end;
    } else if (end > curEnd) {
      curEnd = end;
    }
  }
  if (curStart !== null) {
    total += curEnd - curStart;
  }
  return total;
}

export async function getLastNightSleepMinutes(forDate: Date): Promise<number | null> {
  try {
    const authorized = await requestAuthorization({ toRead: [SLEEP_ANALYSIS_IDENTIFIER] });
    if (!authorized) {
      return null;
    }

    const windowStart = getPreviousDay(forDate);
    windowStart.setHours(12, 0, 0, 0); // noon of the previous day
    const windowEnd = new Date(forDate);
    windowEnd.setHours(12, 0, 0, 0); // noon of forDate

    const samples = (await queryCategorySamples(SLEEP_ANALYSIS_IDENTIFIER, {
      limit: 0,
      filter: { date: { startDate: windowStart, endDate: windowEnd } },
    })) as readonly SleepCategorySample[];

    if (!samples || samples.length === 0) {
      return null;
    }

    const totalMs = mergedDurationMs(samples.filter((sample) => ASLEEP_VALUES.has(sample.value)));

    if (totalMs === 0) {
      return null;
    }

    return Math.round(totalMs / 60000);
  } catch {
    return null;
  }
}
