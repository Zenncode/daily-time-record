"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function createEmployeeAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "EMPLOYEE");
  const department = String(formData.get("department") ?? "").trim();
  const managerId = String(formData.get("managerId") ?? "");
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 || !["EMPLOYEE", "MANAGER"].includes(role)) {
    redirect("/employees?error=invalid");
  }
  if (managerId) {
    const manager = await db.user.findFirst({ where: { id: managerId, role: "MANAGER", active: true } });
    if (!manager) redirect("/employees?error=invalid-manager");
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction(async (tx) => {
      const employee = await tx.user.create({
        data: {
          name, email, passwordHash, role: role as "EMPLOYEE" | "MANAGER",
          department: department || null, managerId: managerId || null,
        },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "EMPLOYEE_CREATED", entityType: "User", entityId: employee.id },
      });
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") redirect("/employees?error=email-in-use");
    throw error;
  }
  revalidatePath("/employees");
  redirect("/employees?success=created");
}

export async function setEmployeeActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || userId === admin.id) redirect("/employees?error=invalid");
  const employee = await db.user.findUnique({ where: { id: userId } });
  if (!employee) redirect("/employees?error=not-found");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { active } }),
    db.auditLog.create({
      data: { actorId: admin.id, action: active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", entityType: "User", entityId: userId },
    }),
  ]);
  revalidatePath("/employees");
  redirect("/employees?success=updated");
}
