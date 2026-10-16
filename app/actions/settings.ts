"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { SYSTEM_SETTINGS_ID } from "@/lib/system-settings";

const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function saveSystemSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const timeZone = String(formData.get("timeZone") ?? "").trim();
  const shiftStart = String(formData.get("shiftStart") ?? "");
  const shiftEnd = String(formData.get("shiftEnd") ?? "");
  const workDays = [...new Set(formData.getAll("workDays").map(Number))].sort((a, b) => a - b);

  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date());
  } catch {
    redirect("/settings?error=invalid-timezone");
  }
  if (
    timeZone.length > 100 ||
    !validTime.test(shiftStart) ||
    !validTime.test(shiftEnd) ||
    shiftStart >= shiftEnd ||
    !workDays.length ||
    workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    redirect("/settings?error=invalid-settings");
  }

  await db.$transaction(async (tx) => {
    await tx.systemSettings.upsert({
      where: { id: SYSTEM_SETTINGS_ID },
      create: { id: SYSTEM_SETTINGS_ID, timeZone, shiftStart, shiftEnd, workDays },
      update: { timeZone, shiftStart, shiftEnd, workDays },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "SYSTEM_SETTINGS_UPDATED",
        entityType: "SystemSettings",
        entityId: SYSTEM_SETTINGS_ID,
        details: { timeZone, shiftStart, shiftEnd, workDays, breakPolicy: "ACTUAL_RECORDED" },
      },
    });
  });

  for (const path of ["/settings", "/dashboard", "/attendance", "/requests", "/reports"]) {
    revalidatePath(path);
  }
  redirect("/settings?success=saved");
}
