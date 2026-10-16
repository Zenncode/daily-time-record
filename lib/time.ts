export function appTimeZone() {
  return process.env.APP_TIMEZONE || "Asia/Manila";
}

export function workDateFor(date: Date, timeZone = appTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function dateTimeLocalInZone(value: string, timeZone = appTimeZone()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const desired = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = desired;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const valueFor = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const actual = Date.UTC(
      valueFor("year"),
      valueFor("month") - 1,
      valueFor("day"),
      valueFor("hour"),
      valueFor("minute"),
      valueFor("second"),
    );
    const correction = target - actual;
    instant += correction;
    if (!correction) break;
  }
  const verified = formatter.formatToParts(new Date(instant));
  const actual = ["year", "month", "day", "hour", "minute"].map(
    (type) => Number(verified.find((part) => part.type === type)?.value),
  );
  if (actual.some((part, index) => part !== desired[index])) return null;
  return new Date(instant);
}

export function formatTime(date: Date | null, timeZone = appTimeZone()) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWorkDate(workDate: string) {
  const [year, month, day] = workDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function durationLabel(seconds: number) {
  const hours = Math.floor(Math.max(0, seconds) / 3600);
  const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function workedSeconds(
  clockIn: Date,
  clockOut: Date | null,
  totalBreakSeconds: number,
  breakStartedAt: Date | null = null,
  now = new Date(),
) {
  const end = clockOut ?? now;
  const activeBreak = breakStartedAt ? Math.max(0, Math.floor((end.getTime() - breakStartedAt.getTime()) / 1000)) : 0;
  return Math.max(0, Math.floor((end.getTime() - clockIn.getTime()) / 1000) - totalBreakSeconds - activeBreak);
}
