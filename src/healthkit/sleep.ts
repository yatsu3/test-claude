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

    const totalMs = samples
      .filter((sample) => ASLEEP_VALUES.has(sample.value))
      .reduce((sum, sample) => sum + (sample.endDate.getTime() - sample.startDate.getTime()), 0);

    if (totalMs === 0) {
      return null;
    }

    return Math.round(totalMs / 60000);
  } catch {
    return null;
  }
}
