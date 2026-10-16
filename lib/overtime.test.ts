import assert from "node:assert/strict";
import test from "node:test";
import { overtimeSeconds } from "./overtime";

const date = "2026-10-16";
const zone = "Asia/Manila";
const shiftEnd = "17:00";
const at = (value: string) => new Date(value);

test("there is no overtime at or before the configured shift end", () => {
  assert.equal(overtimeSeconds(date, at("2026-10-16T09:00:00.000Z"), [], zone, shiftEnd), 0);
  assert.equal(overtimeSeconds(date, at("2026-10-16T08:59:59.000Z"), [], zone, shiftEnd), 0);
});

test("counts time after shift end when no break overlaps overtime", () => {
  assert.equal(overtimeSeconds(date, at("2026-10-16T10:30:00.000Z"), [], zone, shiftEnd), 90 * 60);
});

test("subtracts only the part of a recorded break that overlaps overtime", () => {
  const breaks = [
    { startedAt: at("2026-10-16T08:30:00.000Z"), endedAt: at("2026-10-16T09:15:00.000Z") },
    { startedAt: at("2026-10-16T09:45:00.000Z"), endedAt: at("2026-10-16T10:15:00.000Z") },
  ];
  assert.equal(overtimeSeconds(date, at("2026-10-16T10:30:00.000Z"), breaks, zone, shiftEnd), 45 * 60);
});

test("counts only completed overtime during an active break and caps at now", () => {
  const now = at("2026-10-16T10:00:00.000Z");
  const activeBreak = [{ startedAt: at("2026-10-16T09:45:00.000Z"), endedAt: null }];
  assert.equal(overtimeSeconds(date, null, activeBreak, zone, shiftEnd, now), 45 * 60);
});

test("does not accrue overtime from an unfinished attendance record on a prior workday", () => {
  const nextDay = at("2026-10-17T10:00:00.000Z");
  assert.equal(overtimeSeconds(date, null, [], zone, shiftEnd, nextDay), 0);
});

test("uses the configured shift end and timezone", () => {
  assert.equal(
    overtimeSeconds(date, at("2026-10-16T10:30:00.000Z"), [], zone, "18:00"),
    30 * 60,
  );
});
