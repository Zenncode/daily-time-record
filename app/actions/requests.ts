"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { publishUserAttendanceUpdate } from "@/lib/realtime";
import { workDateFor } from "@/lib/time";
import { canClockOutAt } from "@/lib/schedule";

export async function reviewRequestAction(formData: FormData) {
  const reviewer = await requireManager();
  const requestId = String(formData.get("requestId") ?? "");
  const rawDecision = formData.get("decision");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || (rawDecision !== "APPROVED" && rawDecision !== "REJECTED")) {
    redirect("/requests?error=invalid-request");
  }
  const decision = rawDecision;
  const request = await db.correctionRequest.findUnique({
    where: { id: requestId },
    include: { attendance: true, requester: { select: { managerId: true } } },
  });
  if (!request) redirect("/requests?error=not-found");
  if (reviewer.role === "MANAGER" && request.requester.managerId !== reviewer.id) redirect("/requests?error=forbidden");
  if (request.status !== "PENDING") redirect("/requests?error=already-reviewed");

  if (decision === "APPROVED" && request.type === "CLOCK_IN" && request.requestedAt &&
      ((request.attendance.clockOut && request.requestedAt >= request.attendance.clockOut) ||
        workDateFor(request.requestedAt) !== request.attendance.workDate)) {
    redirect("/requests?error=invalid-correction");
  }
  if (decision === "APPROVED" && request.type === "CLOCK_OUT" && request.requestedAt &&
      (request.requestedAt <= request.attendance.clockIn ||
        workDateFor(request.requestedAt) !== request.attendance.workDate ||
        !canClockOutAt(request.attendance.workDate, request.requestedAt))) {
    redirect("/requests?error=invalid-correction");
  }

  const reviewed = await db.$transaction(async (tx) => {
    const claimed = await tx.correctionRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: decision,
        reviewerId: reviewer.id,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    });
    if (!claimed.count) return false;
    if (decision === "APPROVED") {
      if (request.type === "CLOCK_IN" && request.requestedAt) {
        await tx.attendanceDay.update({ where: { id: request.attendanceId }, data: { clockIn: request.requestedAt } });
      } else if (request.type === "CLOCK_OUT" && request.requestedAt) {
        await tx.attendanceDay.update({ where: { id: request.attendanceId }, data: { clockOut: request.requestedAt, status: "COMPLETE" } });
      } else if (request.type === "BREAK_TOTAL" && request.requestedBreak !== null) {
        await tx.attendanceDay.update({
          where: { id: request.attendanceId },
          data: { totalBreakSeconds: request.requestedBreak * 60, breakStartedAt: null },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: reviewer.id,
        action: `CORRECTION_${decision}`,
        entityType: "CorrectionRequest",
        entityId: request.id,
        details: { attendanceId: request.attendanceId, type: request.type, note: reviewNote || null },
      },
    });
    return true;
  });
  if (!reviewed) redirect("/requests?error=already-reviewed");

  await publishUserAttendanceUpdate(request.requesterId);
  revalidatePath("/requests");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  redirect("/requests?success=reviewed");
}
