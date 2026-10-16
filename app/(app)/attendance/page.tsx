import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { appNow, durationLabel, formatTime, formatWorkDate, workedSeconds } from "@/lib/time";
import { formatScheduleTime, isLateClockIn } from "@/lib/schedule";
import { getSystemSettings } from "@/lib/system-settings";
import { overtimeSeconds } from "@/lib/overtime";
import { CorrectionRequest } from "./correction-request";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await requireSession();
  const [settings, params] = await Promise.all([getSystemSettings(), searchParams]);
  const now = appNow();
  const entries = await db.attendanceDay.findMany({
    where: { userId: user.id },
    include: {
      correctionRequests: { where: { status: "PENDING" }, select: { id: true } },
      breakIntervals: { select: { startedAt: true, endedAt: true } },
    },
    orderBy: { workDate: "desc" },
    take: 100,
  });
  const errorMessage = params.error === "invalid-request" ? "Check your correction details and try again."
    : params.error === "record-not-found" ? "That attendance record could not be found."
    : params.error === "clock-out-before-schedule" ? `Clock out is available at ${formatScheduleTime(settings.shiftEnd)} or later.`
    : params.success === "request-submitted" ? "Your correction request was sent to your manager." : null;

  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">TIME RECORDS</p><h1>My attendance</h1><p className="subtitle">Review your punches and request a correction if something needs fixing.</p></div></div>
    {errorMessage && <div className={`notice ${params.success ? "notice-success" : "notice-error"}`}>{errorMessage}</div>}
    <section className="card">
      <div className="card-header"><div><h2 className="card-title">Attendance history</h2><p className="card-description">Most recent 100 recorded workdays.</p></div><span className="status-pill status-complete">{entries.length} records</span></div>
      {entries.length ? <div className="table-wrap"><table><thead><tr><th>Work date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours worked</th><th>Overtime</th><th>Status</th><th>Correction</th></tr></thead><tbody>{entries.map((entry) => {
        const pending = entry.correctionRequests.length > 0;
        const late = isLateClockIn(entry.clockIn, entry.workDate, settings.timeZone, settings.shiftStart);
        return <tr key={entry.id}><td className="cell-primary">{formatWorkDate(entry.workDate)}</td><td>{formatTime(entry.clockIn, settings.timeZone)}</td><td>{formatTime(entry.clockOut, settings.timeZone)}</td><td>{durationLabel(entry.totalBreakSeconds)}</td><td className="cell-primary">{durationLabel(workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds))}</td><td>{durationLabel(overtimeSeconds(entry.workDate, entry.clockOut, entry.breakIntervals, settings.timeZone, settings.shiftEnd, now))}</td><td>{late && <span className="status-pill status-late" style={{ marginRight: 6 }}>Late</span>}<span className={`status-pill ${entry.clockOut ? "status-complete" : ""}`}>{entry.clockOut ? "Complete" : "In progress"}</span></td><td>{pending ? <span className="status-pill status-pending">Pending</span> : <CorrectionRequest attendanceId={entry.id} hasClockOut={Boolean(entry.clockOut)} />}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state">No attendance records yet. Clock in from your dashboard to start your first record.</div>}
    </section>
  </main>;
}
