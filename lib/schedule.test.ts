import assert from "node:assert/strict";
import test from "node:test";
import { canClockOutAt, isLateClockIn, isScheduledWorkday, scheduledEndAt } from "./schedule";
import { workedSeconds } from "./time";

const workDate = "2026-10-16";

test("regular schedule is Monday through Friday only", () => {
  assert.equal(isScheduledWorkday("2026-10-16"), true);
  assert.equal(isScheduledWorkday("2026-10-17"), false);
  assert.equal(isScheduledWorkday("2026-10-18"), false);
  assert.equal(isScheduledWorkday("2026-02-30"), false);
});

test("an early or exact 8:00 AM punch is not late", () => {
  assert.equal(isLateClockIn(new Date("2026-10-15T23:59:00.000Z"), workDate, "Asia/Manila"), false);
  assert.equal(isLateClockIn(new Date("2026-10-16T00:00:00.000Z"), workDate, "Asia/Manila"), false);
});

test("clock-in after 8:00 AM is marked late", () => {
  assert.equal(isLateClockIn(new Date("2026-10-16T00:00:00.001Z"), workDate, "Asia/Manila"), true);
});

test("clock-out is blocked before 5:00 PM and allowed at or after 5:00 PM", () => {
  const shiftEnd = scheduledEndAt(workDate, "Asia/Manila");
  assert.ok(shiftEnd);
  assert.equal(shiftEnd.toISOString(), "2026-10-16T09:00:00.000Z");
  assert.equal(canClockOutAt(workDate, new Date("2026-10-16T08:59:59.999Z"), "Asia/Manila"), false);
  assert.equal(canClockOutAt(workDate, shiftEnd, "Asia/Manila"), true);
  assert.equal(canClockOutAt(workDate, new Date("2026-10-16T09:00:00.001Z"), "Asia/Manila"), true);
});

test("custom configured workdays and shift times control lateness and clock-out", () => {
  const customDays = [0, 2, 5];
  assert.equal(isScheduledWorkday("2026-10-16", customDays), true);
  assert.equal(isScheduledWorkday("2026-10-15", customDays), false);
  assert.equal(isLateClockIn(new Date("2026-10-16T01:00:00.000Z"), workDate, "Asia/Manila", "09:00"), false);
  assert.equal(isLateClockIn(new Date("2026-10-16T01:00:00.001Z"), workDate, "Asia/Manila", "09:00"), true);
  assert.equal(canClockOutAt(workDate, new Date("2026-10-16T09:59:59.999Z"), "Asia/Manila", "18:00"), false);
  assert.equal(canClockOutAt(workDate, new Date("2026-10-16T10:00:00.000Z"), "Asia/Manila", "18:00"), true);
});

test("8:00 AM to 5:00 PM with a one-hour unpaid break is 8 paid duty hours", () => {
  assert.equal(
    workedSeconds(new Date("2026-10-16T00:00:00.000Z"), new Date("2026-10-16T09:00:00.000Z"), 3600),
    8 * 60 * 60,
  );
});
