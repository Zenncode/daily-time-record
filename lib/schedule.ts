import { appTimeZone, dateTimeLocalInZone } from "./time";

export const WORK_START = "08:00";
export const WORK_END = "17:00";
export const PAID_DUTY_HOURS = 8;

export function isScheduledWorkday(workDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;
  const date = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== workDate) return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

export function scheduledStartAt(workDate: string, timeZone = appTimeZone()) {
  return dateTimeLocalInZone(`${workDate}T${WORK_START}`, timeZone);
}

export function scheduledEndAt(workDate: string, timeZone = appTimeZone()) {
  return dateTimeLocalInZone(`${workDate}T${WORK_END}`, timeZone);
}

export function isLateClockIn(clockIn: Date, workDate: string, timeZone = appTimeZone()) {
  const start = scheduledStartAt(workDate, timeZone);
  return start !== null && clockIn > start;
}

export function canClockOutAt(workDate: string, clockOut: Date, timeZone = appTimeZone()) {
  const end = scheduledEndAt(workDate, timeZone);
  return end !== null && clockOut >= end;
}
