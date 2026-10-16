import { reviewRequestAction } from "@/app/actions/requests";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { formatWorkDate, formatTime } from "@/lib/time";
import { getSystemSettings } from "@/lib/system-settings";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const reviewer = await requireManager();
  const [settings, params] = await Promise.all([getSystemSettings(), searchParams]);
  const requests = await db.correctionRequest.findMany({
    where: reviewer.role === "MANAGER" ? { requester: { managerId: reviewer.id } } : {},
    include: {
      requester: { select: { id: true, name: true, email: true, department: true } },
      attendance: true,
      reviewer: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h1>Correction requests</h1><p className="subtitle">Review requested changes to employee attendance records.</p></div></div>
    {params.error && <div className="notice notice-error">{params.error === "forbidden" ? "You are not authorized to review that request." : params.error === "already-reviewed" ? "Another reviewer already handled that request." : params.error === "invalid-correction" ? "That change would make the punch times invalid." : "That request could not be processed."}</div>}
    {params.success && <div className="notice notice-success">Request reviewed successfully.</div>}
    <div className="grid stats-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
      {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => <div className="card stat-card" key={status}><div className="stat-label">{status.toLowerCase()} requests</div><div className="stat-value">{requests.filter((request) => request.status === status).length}</div><div className="stat-foot">Showing up to 100 recent requests</div></div>)}
    </div>
    <section className="card">
      <div className="card-header"><div><h2 className="card-title">Requests</h2><p className="card-description">The requested update and reason are shown for each item.</p></div></div>
      {requests.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Work date</th><th>Change requested</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}>
        <td><div className="cell-primary">{request.requester.name}</div><div className="cell-secondary">{request.requester.department || request.requester.email}</div></td>
        <td>{formatWorkDate(request.attendance.workDate)}</td>
        <td><div className="cell-primary">{request.type === "CLOCK_IN" ? "Clock-in" : request.type === "CLOCK_OUT" ? "Clock-out" : "Break total"}</div><div className="cell-secondary">{request.type === "BREAK_TOTAL" ? `${request.requestedBreak} minutes` : formatTime(request.requestedAt, settings.timeZone)}</div></td>
        <td style={{ whiteSpace: "normal", minWidth: 180 }}>{request.reason}</td>
        <td><span className={`status-pill ${request.status === "PENDING" ? "status-pending" : request.status === "REJECTED" ? "status-rejected" : "status-complete"}`}>{request.status.toLowerCase()}</span>{request.reviewer && <div className="cell-secondary">by {request.reviewer.name}</div>}</td>
        <td>{request.status === "PENDING" ? <form action={reviewRequestAction} className="grid" style={{ gap: 6, minWidth: 165 }}><input type="hidden" name="requestId" value={request.id} /><input name="reviewNote" className="input" placeholder="Optional note" maxLength={500} /><div className="button-group"><button name="decision" value="APPROVED" className="button button-primary button-small">Approve</button><button name="decision" value="REJECTED" className="button button-danger button-small">Reject</button></div></form> : <span className="cell-secondary">{request.reviewNote || "—"}</span>}</td>
      </tr>)}</tbody></table></div> : <div className="empty-state">No correction requests have been submitted.</div>}
    </section>
  </main>;
}
