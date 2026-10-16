"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { appNow, dateTimeLocalInZone, workDateFor } from "@/lib/time";
import { correctionSchema } from "@/lib/validators";
import { publishUserAttendanceUpdate } from "@/lib/realtime";
import { canClockOutAt, isScheduledWorkday } from "@/lib/schedule";

async function currentAttendance(userId: string) {
  return db.attendanceDay.findUnique({ where: { userId_workDate: { userId, workDate: workDateFor(appNow()) } } });
}

export async function clockInAction() {
  const user = await requireSession();
  const now = appNow();
  const workDate = workDateFor(now);
  if (!isScheduledWorkday(workDate)) redirect("/dashboard?error=not-a-workday");
  try {
    await db.$transaction(async (tx) => {
      const record = await tx.attendanceDay.create({ data: { userId: user.id, workDate, clockIn: now } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "CLOCK_IN", entityType: "AttendanceDay", entityId: record.id },
      });
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      redirect("/dashboard?error=already-clocked");
    }
    throw error;
  }
  await publishUserAttendanceUpdate(user.id);
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
}

export async function clockOutAction() {
  const user = await requireSession();
  const record = await currentAttendance(user.id);
  if (!record || record.clockOut) redirect("/dashboard?error=not-clocked-in");
  if (record.breakStartedAt) redirect("/dashboard?error=end-break-first");
  const now = appNow();
  if (!canClockOutAt(record.workDate, now)) {
    redirect("/dashboard?error=clock-out-before-schedule");
  }
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.attendanceDay.updateMany({
      where: { id: record.id, clockOut: null, breakStartedAt: null },
      data: { clockOut: now, status: "COMPLETE" },
    });
    if (result.count) {
      await tx.auditLog.create({
        data: { actorId: user.id, action: "CLOCK_OUT", entityType: "AttendanceDay", entityId: record.id },
      });
    }
    return result;
  });
  if (!updated.count) redirect("/dashboard?error=not-clocked-in");
  await publishUserAttendanceUpdate(user.id);
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
}

export async function breakAction(formData: FormData) {
  const user = await requireSession();
  const action = formData.get("action");
  const record = await currentAttendance(user.id);
  if (!record || record.clockOut) redirect("/dashboard?error=not-clocked-in");
  if (action === "start") {
    if (record.breakStartedAt) redirect("/dashboard?error=break-already-started");
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.attendanceDay.updateMany({
        where: { id: record.id, clockOut: null, breakStartedAt: null },
        data: { breakStartedAt: appNow() },
      });
      if (result.count) {
        await tx.auditLog.create({
          data: { actorId: user.id, action: "BREAK_STARTED", entityType: "AttendanceDay", entityId: record.id },
        });
      }
      return result;
    });
    if (!updated.count) redirect("/dashboard?error=break-already-started");
  } else if (action === "end") {
    if (!record.breakStartedAt) redirect("/dashboard?error=no-active-break");
    const seconds = Math.max(0, Math.floor((appNow().getTime() - record.breakStartedAt.getTime()) / 1000));
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.attendanceDay.updateMany({
        where: { id: record.id, clockOut: null, breakStartedAt: record.breakStartedAt },
        data: { breakStartedAt: null, totalBreakSeconds: { increment: seconds } },
      });
      if (result.count) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "BREAK_ENDED",
            entityType: "AttendanceDay",
            entityId: record.id,
            details: { seconds },
          },
        });
      }
      return result;
    });
    if (!updated.count) redirect("/dashboard?error=no-active-break");
  } else {
    redirect("/dashboard?error=invalid-action");
  }
  await publishUserAttendanceUpdate(user.id);
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
}

export async function requestCorrectionAction(formData: FormData) {
  const user = await requireSession();
  const parsed = correctionSchema.safeParse({
    attendanceId: formData.get("attendanceId"),
    type: formData.get("type"),
    requestedAt: formData.get("requestedAt"),
    requestedBreak: formData.get("requestedBreak"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/attendance?error=invalid-request");
  const record = await db.attendanceDay.findFirst({
    where: { id: parsed.data.attendanceId, userId: user.id },
  });
  if (!record) redirect("/attendance?error=record-not-found");
  const { type, requestedAt, requestedBreak, reason } = parsed.data;
  const parsedDate = requestedAt ? dateTimeLocalInZone(requestedAt) : null;
  if (requestedAt && !parsedDate) redirect("/attendance?error=invalid-request");
  if (parsedDate && workDateFor(parsedDate) !== record.workDate) redirect("/attendance?error=invalid-request");
  if (type === "CLOCK_OUT" && !record.clockOut) redirect("/attendance?error=invalid-request");
  if (type === "CLOCK_OUT" && parsedDate && !canClockOutAt(record.workDate, parsedDate)) {
    redirect("/attendance?error=invalid-request");
  }
  if (type === "CLOCK_IN" && parsedDate && record.clockOut && parsedDate >= record.clockOut) {
    redirect("/attendance?error=invalid-request");
  }
  if (type === "CLOCK_OUT" && parsedDate && parsedDate <= record.clockIn) {
    redirect("/attendance?error=invalid-request");
  }
  await db.correctionRequest.create({
    data: {
      attendanceId: record.id,
      requesterId: user.id,
      type,
      requestedAt: type === "BREAK_TOTAL" ? null : parsedDate,
      requestedBreak: type === "BREAK_TOTAL" ? requestedBreak : null,
      reason,
    },
  });
  await publishUserAttendanceUpdate(user.id);
  revalidatePath("/attendance");
  revalidatePath("/requests");
  redirect("/attendance?success=request-submitted");
}
