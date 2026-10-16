import { dateTimeLocalInZone, workDateFor } from "./time";
import { WORK_END } from "./schedule";

export type BreakIntervalInput = {
  startedAt: Date;
  endedAt: Date | null;
};

export function overtimeSeconds(
  workDate: string,
  clockOut: Date | null,
  breaks: BreakIntervalInput[],
  timeZone: string,
  shiftEnd: string,
  now = new Date(),
) {
  if (!clockOut && workDateFor(now, timeZone) !== workDate) return 0;
  const scheduledEnd = dateTimeLocalInZone(`${workDate}T${shiftEnd || WORK_END}`, timeZone);
  if (!scheduledEnd) return 0;
  const actualEnd = clockOut ?? now;
  const overtimeEnd = actualEnd.getTime();
  const overtimeStart = scheduledEnd.getTime();
  if (overtimeEnd <= overtimeStart) return 0;

  const grossSeconds = Math.floor((overtimeEnd - overtimeStart) / 1000);
  const breakSeconds = breaks.reduce((total, interval) => {
    const breakStart = Math.max(overtimeStart, interval.startedAt.getTime());
    const breakEnd = Math.min(overtimeEnd, (interval.endedAt ?? now).getTime());
    return total + Math.max(0, Math.floor((breakEnd - breakStart) / 1000));
  }, 0);
  return Math.max(0, grossSeconds - breakSeconds);
}
