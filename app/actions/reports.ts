"use server";

import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { appNow, durationLabel, formatTime, workedSeconds } from "@/lib/time";
import { getSystemSettings } from "@/lib/system-settings";
import { overtimeSeconds } from "@/lib/overtime";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function csvCell(value: string | number) {
  const rawValue = String(value);
  const stringValue = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(rawValue)
    ? `'${rawValue}`
    : rawValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export async function exportAttendanceAction(formData: FormData) {
  const manager = await requireManager();
  const settings = await getSystemSettings();
  const now = appNow();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!validDate(from) || !validDate(to) || from > to) return { error: "Choose a valid date range." };
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (days > 366) return { error: "Reports are limited to a one-year date range." };
  const rows = await db.attendanceDay.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(manager.role === "MANAGER" ? { user: { managerId: manager.id } } : {}),
    },
    include: {
      user: { select: { name: true, email: true, department: true } },
      breakIntervals: { select: { startedAt: true, endedAt: true } },
    },
    orderBy: [{ workDate: "asc" }, { user: { name: "asc" } }],
  });
  const lines = [
    ["Employee", "Email", "Department", "Work date", "Clock in", "Clock out", "Break minutes", "Hours worked", "Overtime", "Status"].map(csvCell).join(","),
    ...rows.map((row) => [
      row.user.name,
      row.user.email,
      row.user.department ?? "",
      row.workDate,
      formatTime(row.clockIn, settings.timeZone),
      formatTime(row.clockOut, settings.timeZone),
      Math.round(row.totalBreakSeconds / 60),
      (workedSeconds(row.clockIn, row.clockOut, row.totalBreakSeconds) / 3600).toFixed(2),
      durationLabel(overtimeSeconds(row.workDate, row.clockOut, row.breakIntervals, settings.timeZone, settings.shiftEnd, now)),
      row.clockOut ? "Complete" : "In progress",
    ].map(csvCell).join(",")),
  ];
  return { csv: `\uFEFF${lines.join("\r\n")}`, filename: `attendance-${from}-to-${to}.csv` };
}
