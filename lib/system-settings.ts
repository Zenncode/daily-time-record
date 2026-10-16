import "server-only";
import { db } from "@/lib/db";
import { appTimeZone } from "@/lib/time";

export const SYSTEM_SETTINGS_ID = "global";
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export type SystemSettings = {
  timeZone: string;
  workDays: number[];
  shiftStart: string;
  shiftEnd: string;
  breakPolicy: "ACTUAL_RECORDED";
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await db.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  return {
    timeZone: settings?.timeZone ?? appTimeZone(),
    workDays: settings?.workDays ?? DEFAULT_WORK_DAYS,
    shiftStart: settings?.shiftStart ?? "08:00",
    shiftEnd: settings?.shiftEnd ?? "17:00",
    breakPolicy: "ACTUAL_RECORDED",
  };
}
