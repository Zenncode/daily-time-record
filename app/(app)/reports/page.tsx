import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { appNow, appTimeZone, durationLabel, formatTime, formatWorkDate, workDateFor, workedSeconds } from "@/lib/time";
import { isLateClockIn } from "@/lib/schedule";
import ExportForm from "./export-form";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const viewer = await requireManager();
  const params = await searchParams;
  const now = appNow();
  const defaultTo = workDateFor(now);
  const defaultFrom = `${defaultTo.slice(0, 7)}-01`;
  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : defaultFrom;
  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : defaultTo;
  const rangeIsValid = from <= to && (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 <= 366;
  const entries = rangeIsValid ? await db.attendanceDay.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(viewer.role === "MANAGER" ? { user: { managerId: viewer.id } } : {}),
    },
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: [{ workDate: "desc" }, { user: { name: "asc" } }],
    take: 1000,
  }) : [];
  const seconds = entries.reduce((total, entry) => total + workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds), 0);
  const employees = new Set(entries.map((entry) => entry.userId)).size;
  const complete = entries.filter((entry) => !!entry.clockOut).length;
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
      <div className="card stat-card"><div className="stat-label">Completed shifts</div><div className="stat-value">{complete}</div><div className="stat-foot">Shifts with a clock-out</div></div>
    </div>
    <section className="card section-spacer">
      <div className="card-header"><div><h2 className="card-title">Attendance details</h2><p className="card-description">Times are displayed in {appTimeZone()}.</p></div></div>
      {entries.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours worked</th><th>Status</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}>
        <td className="cell-primary">{entry.user.name}</td><td>{entry.user.department || "—"}</td><td>{formatWorkDate(entry.workDate)}</td><td>{formatTime(entry.clockIn)}</td><td>{formatTime(entry.clockOut)}</td><td>{durationLabel(entry.totalBreakSeconds)}</td><td className="cell-primary">{durationLabel(workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds))}</td><td>{isLateClockIn(entry.clockIn, entry.workDate) && <span className="status-pill status-late" style={{ marginRight: 6 }}>Late</span>}<span className={`status-pill ${entry.clockOut ? "status-complete" : ""}`}>{entry.clockOut ? "Complete" : "In progress"}</span></td>
      </tr>)}</tbody></table></div> : <div className="empty-state">No attendance records match this report period.</div>}
    </section>
  </main>;
}
