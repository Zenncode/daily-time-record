import { appTimeZone, dateTimeLocalInZone } from "./time";

export const WORK_START = "08:00";
export const WORK_END = "17:00";
export const PAID_DUTY_HOURS = 8;
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function isScheduledWorkday(workDate: string, workDays = [1, 2, 3, 4, 5]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;
  const date = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== workDate) return false;
  const day = date.getUTCDay();
  return workDays.includes(day);
}

export function scheduledStartAt(workDate: string, timeZone = appTimeZone(), shiftStart = WORK_START) {
  return dateTimeLocalInZone(`${workDate}T${shiftStart}`, timeZone);
}

export function scheduledEndAt(workDate: string, timeZone = appTimeZone(), shiftEnd = WORK_END) {
  return dateTimeLocalInZone(`${workDate}T${shiftEnd}`, timeZone);
}

export function isLateClockIn(clockIn: Date, workDate: string, timeZone = appTimeZone(), shiftStart = WORK_START) {
  const start = scheduledStartAt(workDate, timeZone, shiftStart);
  return start !== null && clockIn > start;
}

export function canClockOutAt(workDate: string, clockOut: Date, timeZone = appTimeZone(), shiftEnd = WORK_END) {
  const end = scheduledEndAt(workDate, timeZone, shiftEnd);
  return end !== null && clockOut >= end;
}

export function formatScheduleTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;
  const time = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}

export function formatWorkDays(workDays: number[]) {
  if (workDays.length === 7) return "Every day";
  return [...workDays].sort((left, right) => left - right).map((day) => WEEKDAY_NAMES[day]).join(", ");
}
