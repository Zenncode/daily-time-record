import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { appNow, durationLabel, formatTime, formatWorkDate, workDateFor, workedSeconds } from "@/lib/time";
import { isLateClockIn } from "@/lib/schedule";
import ExportForm from "./export-form";
import { getSystemSettings } from "@/lib/system-settings";
import { overtimeSeconds } from "@/lib/overtime";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const viewer = await requireManager();
  const params = await searchParams;
  const settings = await getSystemSettings();
  const now = appNow();
  const defaultTo = workDateFor(now, settings.timeZone);
  const defaultFrom = `${defaultTo.slice(0, 7)}-01`;
  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : defaultFrom;
  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : defaultTo;
  const rangeIsValid = from <= to && (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 <= 366;
  const entries = rangeIsValid ? await db.attendanceDay.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(viewer.role === "MANAGER" ? { user: { managerId: viewer.id } } : {}),
    },
    include: {
      user: { select: { id: true, name: true, department: true } },
      breakIntervals: { select: { startedAt: true, endedAt: true } },
    },
    orderBy: [{ workDate: "desc" }, { user: { name: "asc" } }],
    take: 1000,
  }) : [];
  const seconds = entries.reduce((total, entry) => total + workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds), 0);
  const overtime = entries.reduce((total, entry) => total + overtimeSeconds(
    entry.workDate, entry.clockOut, entry.breakIntervals, settings.timeZone, settings.shiftEnd, now,
  ), 0);
  const employees = new Set(entries.map((entry) => entry.userId)).size;
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">REPORTING</p><h1>Attendance reports</h1><p className="subtitle">Review attendance totals for your organization or team.</p></div></div>
    {!rangeIsValid && <div className="notice notice-error">Choose a valid date range of no more than one year.</div>}
    <section className="card">
      <div className="card-header"><div><h2 className="card-title">Report period</h2><p className="card-description">Export detailed records as a spreadsheet-compatible CSV file.</p></div></div>
      <ExportForm from={from} to={to} />
    </section>
    <div className="grid stats-grid section-spacer">
      <div className="card stat-card"><div className="stat-label">Attendance records</div><div className="stat-value">{entries.length}</div><div className="stat-foot">{from} to {to}</div></div>
      <div className="card stat-card"><div className="stat-label">Employees recorded</div><div className="stat-value">{employees}</div><div className="stat-foot">Unique employees in period</div></div>
      <div className="card stat-card"><div className="stat-label">Hours recorded</div><div className="stat-value" style={{ fontSize: 23 }}>{durationLabel(seconds)}</div><div className="stat-foot">Net of recorded breaks</div></div>
      <div className="card stat-card"><div className="stat-label">Overtime recorded</div><div className="stat-value" style={{ fontSize: 23 }}>{durationLabel(overtime)}</div><div className="stat-foot">After scheduled end, less overlapping breaks</div></div>
    </div>
    <section className="card section-spacer">
      <div className="card-header"><div><h2 className="card-title">Attendance details</h2><p className="card-description">Times are displayed in {settings.timeZone}.</p></div></div>
      {entries.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours worked</th><th>Overtime</th><th>Status</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}>
        <td className="cell-primary">{entry.user.name}</td><td>{entry.user.department || "—"}</td><td>{formatWorkDate(entry.workDate)}</td><td>{formatTime(entry.clockIn, settings.timeZone)}</td><td>{formatTime(entry.clockOut, settings.timeZone)}</td><td>{durationLabel(entry.totalBreakSeconds)}</td><td className="cell-primary">{durationLabel(workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds))}</td><td>{durationLabel(overtimeSeconds(entry.workDate, entry.clockOut, entry.breakIntervals, settings.timeZone, settings.shiftEnd, now))}</td><td>{isLateClockIn(entry.clockIn, entry.workDate, settings.timeZone, settings.shiftStart) && <span className="status-pill status-late" style={{ marginRight: 6 }}>Late</span>}<span className={`status-pill ${entry.clockOut ? "status-complete" : ""}`}>{entry.clockOut ? "Complete" : "In progress"}</span></td>
      </tr>)}</tbody></table></div> : <div className="empty-state">No attendance records match this report period.</div>}
    </section>
  </main>;
}
