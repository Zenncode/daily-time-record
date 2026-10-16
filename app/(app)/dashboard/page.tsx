import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, Clock3, Coffee, UsersRound } from "lucide-react";
import { clockInAction, clockOutAction, breakAction } from "@/app/actions/attendance";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { appNow, durationLabel, formatTime, formatWorkDate, workDateFor, workedSeconds } from "@/lib/time";
import LiveClock from "@/app/(app)/live-clock";
import { formatScheduleTime, formatWorkDays, isLateClockIn } from "@/lib/schedule";
import { getSystemSettings } from "@/lib/system-settings";
import { overtimeSeconds } from "@/lib/overtime";

const errorMessages: Record<string, string> = {
  "already-clocked": "You already have an attendance record for today.",
  "not-clocked-in": "Clock in before using this action.",
  "end-break-first": "End your active break before clocking out.",
  "break-already-started": "Your break is already active.",
  "no-active-break": "There is no active break to end.",
  "invalid-action": "That action is not valid.",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireSession();
  const [settings, { error }] = await Promise.all([getSystemSettings(), searchParams]);
  const now = appNow();
  const todayKey = workDateFor(now, settings.timeZone);
  const today = await db.attendanceDay.findUnique({
    where: { userId_workDate: { userId: user.id, workDate: todayKey } },
    include: { breakIntervals: { select: { startedAt: true, endedAt: true } } },
  });
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const recent = await db.attendanceDay.findMany({
    where: user.role === "ADMIN" ? { clockIn: { gte: weekAgo } } : user.role === "MANAGER"
      ? { clockIn: { gte: weekAgo }, user: { managerId: user.id } }
      : { userId: user.id, clockIn: { gte: weekAgo } },
    include: {
      user: { select: { name: true } },
      breakIntervals: { select: { startedAt: true, endedAt: true } },
    },
    orderBy: { clockIn: "desc" },
    take: 6,
  });
  const teamCount = user.role === "ADMIN" ? await db.user.count({ where: { active: true } })
    : user.role === "MANAGER" ? await db.user.count({ where: { managerId: user.id, active: true } }) : null;
  const pendingCount = user.role === "EMPLOYEE" ? 0 : await db.correctionRequest.count({
    where: { status: "PENDING", ...(user.role === "MANAGER" ? { requester: { managerId: user.id } } : {}) },
  });
  const myRecent = user.role === "EMPLOYEE" ? await db.attendanceDay.findMany({
    where: { userId: user.id }, include: { breakIntervals: { select: { startedAt: true, endedAt: true } } },
    orderBy: { workDate: "desc" }, take: 4,
  }) : [];
  const activeBreak = !!today?.breakStartedAt;
  const working = !!today && !today.clockOut;
  const worked = today ? workedSeconds(today.clockIn, today.clockOut, today.totalBreakSeconds, today.breakStartedAt) : 0;
  const overtimeToday = today ? overtimeSeconds(today.workDate, today.clockOut, today.breakIntervals, settings.timeZone, settings.shiftEnd, now) : 0;
  const todayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: settings.timeZone }).format(now);
  const isLateToday = today ? isLateClockIn(today.clockIn, today.workDate, settings.timeZone, settings.shiftStart) : false;

  async function startBreak() { "use server"; const data = new FormData(); data.set("action", "start"); await breakAction(data); }
  async function endBreak() { "use server"; const data = new FormData(); data.set("action", "end"); await breakAction(data); }

  if (!user) redirect("/login");
  return (
    <main className="page dashboard-page">
      <div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Good day, {user.name.split(" ")[0]}</h1><p className="subtitle">Here&apos;s your attendance overview for today.</p></div><div className="button-group"><Link className="button button-outline" href="/attendance"><CalendarCheck size={14} />Attendance history</Link></div></div>
      {error && (error === "clock-out-before-schedule"
        ? <div className="notice notice-error">Clock out is available at {formatScheduleTime(settings.shiftEnd)} or later.</div>
        : error === "not-a-workday"
          ? <div className="notice notice-error">Today is not a scheduled workday ({formatWorkDays(settings.workDays)}). Contact your manager if you are working today.</div>
          : errorMessages[error] && <div className="notice notice-error">{errorMessages[error]}</div>)}
      <div className="notice schedule-notice"><strong>Regular schedule:</strong> {formatWorkDays(settings.workDays)}, {formatScheduleTime(settings.shiftStart)}–{formatScheduleTime(settings.shiftEnd)}. Your actual recorded break duration is deducted from worked hours.</div>
      <div className="grid stats-grid">
        <div className="card stat-card"><div className="stat-label">Today&apos;s hours</div><div className="stat-icon"><Clock3 size={17} /></div><div className="stat-value">{today ? durationLabel(worked) : "—"}</div><div className="stat-foot">{today?.clockOut ? "Shift complete" : today ? "In progress" : "Not clocked in yet"}</div></div>
        <div className="card stat-card"><div className="stat-label">First punch</div><div className="stat-icon"><CalendarCheck size={17} /></div><div className="stat-value" style={{ fontSize: 24 }}>{today ? formatTime(today.clockIn, settings.timeZone) : "—"}</div><div className="stat-foot">{today ? todayLabel : "Your shift begins when you clock in"}{isLateToday && <span className="schedule-late"> · Late</span>}</div></div>
        {user.role === "EMPLOYEE" ? <div className="card stat-card"><div className="stat-label">Break time today</div><div className="stat-icon"><Coffee size={17} /></div><div className="stat-value">{durationLabel(today?.totalBreakSeconds ?? 0)}</div><div className="stat-foot">{activeBreak ? "Break currently active" : "Total recorded break"}</div></div>
          : <div className="card stat-card"><div className="stat-label">Team members</div><div className="stat-icon"><UsersRound size={17} /></div><div className="stat-value">{teamCount}</div><div className="stat-foot">Active accounts</div></div>}
        {user.role === "EMPLOYEE" ? <div className="card stat-card"><div className="stat-label">Overtime today</div><div className="stat-icon"><Clock3 size={17} /></div><div className="stat-value">{durationLabel(overtimeToday)}</div><div className="stat-foot">{today?.clockOut ? "Beyond scheduled shift end" : "Accrues after shift end"}</div></div>
          : <div className="card stat-card"><div className="stat-label">Pending approvals</div><div className="stat-icon"><CalendarCheck size={17} /></div><div className="stat-value">{pendingCount}</div><div className="stat-foot"><Link href="/requests" style={{ color: "var(--green)" }}>Review requests →</Link></div></div>}
      </div>
      <div className="grid dashboard-grid">
        <div className="grid" style={{ gap: 18 }}>
          <section className="card clock-card">
            <div className="clock-date">{todayLabel}</div>
            <LiveClock timeZone={settings.timeZone} />
            <div className="clock-state">{!today ? "You haven't started your day yet." : today.clockOut ? `Clocked out at ${formatTime(today.clockOut, settings.timeZone)}` : activeBreak ? "You're currently on a break." : `Clocked in at ${formatTime(today.clockIn, settings.timeZone)} · ${durationLabel(worked)} worked`}</div>
            <div className="clock-actions">
              {!today && <form action={clockInAction}><button className="button button-light"><Clock3 size={14} />Clock in</button></form>}
              {working && !activeBreak && <form action={startBreak}><button className="button button-light"><Coffee size={14} />Start break</button></form>}
              {working && activeBreak && <form action={endBreak}><button className="button button-light"><Coffee size={14} />End break</button></form>}
              {working && <form action={clockOutAction}><button className="button" style={{ background: "#ffffff20", color: "#fff", borderColor: "#ffffff40" }}>Clock out</button></form>}
              {today?.clockOut && <span className="button" style={{ background: "#ffffff20", color: "#fff" }}>Shift complete</span>}
            </div>
          </section>
          <section className="card">
            <div className="card-header"><div><h2 className="card-title">{user.role === "EMPLOYEE" ? "Your recent attendance" : "Recent team activity"}</h2><p className="card-description">The latest recorded time entries.</p></div><Link href="/attendance" style={{ color: "var(--green)", fontSize: 11, fontWeight: 700 }}>View all <ArrowRight size={12} style={{ verticalAlign: "-2px" }} /></Link></div>
            {user.role === "EMPLOYEE" ? myRecent.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Overtime</th><th>Status</th></tr></thead><tbody>{myRecent.map((item) => <tr key={item.id}><td className="cell-primary">{formatWorkDate(item.workDate)}</td><td>{formatTime(item.clockIn, settings.timeZone)}</td><td>{formatTime(item.clockOut, settings.timeZone)}</td><td>{durationLabel(workedSeconds(item.clockIn, item.clockOut, item.totalBreakSeconds))}</td><td>{durationLabel(overtimeSeconds(item.workDate, item.clockOut, item.breakIntervals, settings.timeZone, settings.shiftEnd, now))}</td><td><span className={`status-pill ${item.clockOut ? "status-complete" : ""}`}>{item.clockOut ? "Complete" : "In progress"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">Your time entries will appear here after you clock in.</div>
              : recent.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Overtime</th><th>Status</th></tr></thead><tbody>{recent.map((item) => { const late = isLateClockIn(item.clockIn, item.workDate, settings.timeZone, settings.shiftStart); return <tr key={item.id}><td className="cell-primary">{item.user.name}</td><td>{formatWorkDate(item.workDate)}</td><td>{formatTime(item.clockIn, settings.timeZone)}</td><td>{formatTime(item.clockOut, settings.timeZone)}</td><td>{durationLabel(overtimeSeconds(item.workDate, item.clockOut, item.breakIntervals, settings.timeZone, settings.shiftEnd, now))}</td><td>{late && <span className="status-pill status-late" style={{ marginRight: 6 }}>Late</span>}<span className={`status-pill ${item.clockOut ? "status-complete" : ""}`}>{item.clockOut ? "Complete" : "In progress"}</span></td></tr>; })}</tbody></table></div> : <div className="empty-state">Team attendance will appear here.</div>}
          </section>
        </div>
        <section className="card">
          <div className="card-header"><div><h2 className="card-title">Today at a glance</h2><p className="card-description">{todayLabel}</p></div><span className="stat-icon" style={{ position: "static" }}><CalendarCheck size={17} /></span></div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 17 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 17 }}><span className="stat-label">Work date</span><strong style={{ fontSize: 12 }}>{todayKey}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 17 }}><span className="stat-label">Clock in</span><strong style={{ fontSize: 12 }}>{formatTime(today?.clockIn ?? null, settings.timeZone)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 17 }}><span className="stat-label">Clock out</span><strong style={{ fontSize: 12 }}>{formatTime(today?.clockOut ?? null, settings.timeZone)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><span className="stat-label">Break total</span><strong style={{ fontSize: 12 }}>{durationLabel(today?.totalBreakSeconds ?? 0)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><span className="stat-label">Overtime</span><strong style={{ fontSize: 12 }}>{durationLabel(overtimeToday)}</strong></div>
            {user.role === "EMPLOYEE" && <Link href="/attendance" className="button button-outline" style={{ width: "100%" }}>View or request a correction</Link>}
            {user.role !== "EMPLOYEE" && <Link href={user.role === "ADMIN" ? "/employees" : "/requests"} className="button button-outline" style={{ width: "100%" }}>{user.role === "ADMIN" ? "Manage employees" : "Review approvals"}</Link>}
          </div>
        </section>
      </div>
    </main>
  );
}
