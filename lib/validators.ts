import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export const correctionSchema = z.object({
  attendanceId: z.uuid(),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT", "BREAK_TOTAL"]),
  requestedAt: z.string().optional(),
  requestedBreak: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(0).max(1440).optional(),
  ),
  reason: z.string().trim().min(5).max(500),
}).superRefine((value, ctx) => {
  if (value.type !== "BREAK_TOTAL" && !value.requestedAt) {
    ctx.addIssue({ code: "custom", path: ["requestedAt"], message: "Select a requested time." });
  }
  if (value.type === "BREAK_TOTAL" && value.requestedBreak === undefined) {
    ctx.addIssue({ code: "custom", path: ["requestedBreak"], message: "Enter break minutes." });
  }
});
