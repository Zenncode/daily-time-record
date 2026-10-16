CREATE TABLE "BreakInterval" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakInterval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BreakInterval_attendanceId_startedAt_idx" ON "BreakInterval"("attendanceId", "startedAt");
CREATE INDEX "BreakInterval_attendanceId_endedAt_idx" ON "BreakInterval"("attendanceId", "endedAt");

ALTER TABLE "BreakInterval"
ADD CONSTRAINT "BreakInterval_attendanceId_fkey"
FOREIGN KEY ("attendanceId") REFERENCES "AttendanceDay"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH break_starts AS (
    SELECT
        logs."entityId"::UUID AS "attendanceId",
        logs."createdAt" AS "startedAt",
        ROW_NUMBER() OVER (PARTITION BY logs."entityId" ORDER BY logs."createdAt", logs."id") AS rn
    FROM "AuditLog" AS logs
    JOIN "AttendanceDay" AS attendance ON attendance."id" = logs."entityId"::UUID
    WHERE logs."entityType" = 'AttendanceDay' AND logs."action" = 'BREAK_STARTED'
), break_ends AS (
    SELECT
        logs."entityId"::UUID AS "attendanceId",
        logs."createdAt" AS "endedAt",
        ROW_NUMBER() OVER (PARTITION BY logs."entityId" ORDER BY logs."createdAt", logs."id") AS rn
    FROM "AuditLog" AS logs
    JOIN "AttendanceDay" AS attendance ON attendance."id" = logs."entityId"::UUID
    WHERE logs."entityType" = 'AttendanceDay' AND logs."action" = 'BREAK_ENDED'
)
INSERT INTO "BreakInterval" ("id", "attendanceId", "startedAt", "endedAt")
SELECT gen_random_uuid(), s."attendanceId", s."startedAt", e."endedAt"
FROM break_starts AS s
JOIN break_ends AS e
  ON e."attendanceId" = s."attendanceId"
 AND e.rn = s.rn
WHERE e."endedAt" >= s."startedAt";

INSERT INTO "BreakInterval" ("id", "attendanceId", "startedAt")
SELECT gen_random_uuid(), "id", "breakStartedAt"
FROM "AttendanceDay"
WHERE "breakStartedAt" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "BreakInterval"
      WHERE "BreakInterval"."attendanceId" = "AttendanceDay"."id"
        AND "BreakInterval"."startedAt" = "AttendanceDay"."breakStartedAt"
  );
