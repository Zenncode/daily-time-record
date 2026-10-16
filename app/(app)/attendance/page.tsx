import { requestCorrectionAction } from "@/app/actions/attendance";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { durationLabel, formatTime, formatWorkDate, workedSeconds } from "@/lib/time";
import { isLateClockIn } from "@/lib/schedule";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await requireSession();
  const params = await searchParams;
  const entries = await db.attendanceDay.findMany({
    where: { userId: user.id },
    include: { correctionRequests: { where: { status: "PENDING" }, select: { id: true } } },
    orderBy: { workDate: "desc" },
    take: 100,
  });
  const errorMessage = params.error === "invalid-request" ? "Check your correction details and try again."
    : params.error === "record-not-found" ? "That attendance record could not be found."
    : params.error === "clock-out-before-schedule" ? "Clock out is available at 5:00 PM or later."
    : params.success === "request-submitted" ? "Your correction request was sent to your manager." : null;

  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">TIME RECORDS</p><h1>My attendance</h1><p className="subtitle">Review your punches and request a correction if something needs fixing.</p></div></div>
    {errorMessage && <div className={`notice ${params.success ? "notice-success" : "notice-error"}`}>{errorMessage}</div>}
    <section className="card">
      <div className="card-header"><div><h2 className="card-title">Attendance history</h2><p className="card-description">Most recent 100 recorded workdays.</p></div><span className="status-pill status-complete">{entries.length} records</span></div>
      {entries.length ? <div className="table-wrap"><table><thead><tr><th>Work date</th><th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours worked</th><th>Status</th><th>Correction</th></tr></thead><tbody>{entries.map((entry) => {
        const pending = entry.correctionRequests.length > 0;
        const late = isLateClockIn(entry.clockIn, entry.workDate);
        return <tr key={entry.id}><td className="cell-primary">{formatWorkDate(entry.workDate)}</td><td>{formatTime(entry.clockIn)}{late && <span className="schedule-late"> · Late</span>}</td><td>{formatTime(entry.clockOut)}</td><td>{durationLabel(entry.totalBreakSeconds)}</td><td className="cell-primary">{durationLabel(workedSeconds(entry.clockIn, entry.clockOut, entry.totalBreakSeconds))}</td><td>{late && <span className="status-pill status-late" style={{ marginRight: 6 }}>Late</span>}<span className={`status-pill ${entry.clockOut ? "status-complete" : ""}`}>{entry.clockOut ? "Complete" : "In progress"}</span></td><td>{pending ? <span className="status-pill status-pending">Pending</span> : <details><summary style={{ color: "var(--green)", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Request change</summary><form action={requestCorrectionAction} className="card" style={{ position: "absolute", zIndex: 1, width: 300, boxShadow: "0 10px 35px #183b2c20", marginTop: 8 }}>
          <input type="hidden" name="attendanceId" value={entry.id} />
          <div className="field"><label htmlFor={`correction-type-${entry.id}`}>What needs correcting?</label><select className="select" id={`correction-type-${entry.id}`} name="type" required><option value="CLOCK_IN">Clock-in time</option>{entry.clockOut && <option value="CLOCK_OUT">Clock-out time</option>}<option value="BREAK_TOTAL">Total break time</option></select></div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor={`correction-time-${entry.id}`}>Correct time (if changing a punch)</label><input className="input" id={`correction-time-${entry.id}`} type="datetime-local" name="requestedAt" /></div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor={`correction-break-${entry.id}`}>Break minutes (if correcting break)</label><input className="input" id={`correction-break-${entry.id}`} type="number" name="requestedBreak" min="0" max="1440" /></div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor={`correction-reason-${entry.id}`}>Reason</label><textarea className="textarea" id={`correction-reason-${entry.id}`} name="reason" minLength={5} maxLength={500} required /></div>
          <button className="button button-primary" style={{ marginTop: 12 }}>Send request</button>
        </form></details>}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state">No attendance records yet. Clock in from your dashboard to start your first record.</div>}
    </section>
  </main>;
}
