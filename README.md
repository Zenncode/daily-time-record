# Daymark — Daily Time Record

A server-rendered DTR application built with Next.js App Router, PostgreSQL, Prisma, and Server Actions. It does not expose a separate REST/GraphQL API; database reads and writes run on the server.

## Included

- Secure email/password sign-in, hashed passwords, and signed HTTP-only sessions
- Employee clock-in, clock-out, and break tracking
- Attendance history and correction requests
- Manager review and approval/rejection workflow
- Administrator employee and manager account management
- Team and organization attendance reports with CSV export
- Role-based access checks in server pages and Server Actions
- Admin-configurable timezone and work schedule used for work dates, late detection, and clock-out validation
- Audit events for punches, break actions, account changes, and correction reviews
- Same-origin WebSocket updates for dashboards, team attendance, approvals, reports, and employee changes
- A live, ticking clock and background WebSocket updates
- Configurable scheduled workdays and shift hours, with late arrivals flagged and early clock-outs blocked
- Automatic overtime totals after the configured shift end, excluding breaks that overlap overtime
- Responsive desktop/mobile interface

## Run locally

Requirements: Node.js 20+, npm, PostgreSQL, and an optional Redis server for multi-instance realtime updates.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters), and a strong `ADMIN_PASSWORD` (at least 12 characters). If you are running multiple app servers behind a load balancer, also set `REDIS_URL`.
2. Install dependencies: `npm install`.
3. Create the database schema: `npx prisma migrate dev --name init`.
4. Create the first administrator: `npm run db:seed`.
5. Start the app and its same-origin WebSocket endpoint: `npm run dev`.
6. Open `http://localhost:3100` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

The seed command creates the initial administrator only if that email does not already exist; it does not reset an existing password. The initial timezone defaults to `APP_TIMEZONE` (or `Asia/Manila`) until an administrator saves system settings.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:unit` — checks weekday schedule boundaries, late-punch detection, and clock-out eligibility.
- `npm run test:e2e` — runs Playwright against a running PostgreSQL database, creates temporary test manager/employee accounts, and deletes them afterward.

The first E2E run may need a browser download: `npx playwright install chromium`. E2E tests require the seeded administrator credentials in `.env`; they do not reset or delete the administrator account. The test server uses a fixed test clock so schedule validations work consistently regardless of the day or time the suite is run. The full workflow test also checks that a manager dashboard updates live when an employee clocks in.

## Realtime behavior

The custom Node server (`server.mjs`) serves Next.js and upgrades same-origin connections at `/_dtr/realtime`. It authenticates the existing HTTP-only session cookie, checks the browser origin, and scopes live invalidation messages to the employee, assigned manager, and administrators. Attendance, correction, and employee-management Server Actions publish only a small refresh event; clients refresh their current server-rendered view when they receive it. The dashboard clock ticks locally each second.

The WebSocket relay runs on the same port as Next.js, so local development and production do not need a separate public realtime service. In production, run `npm run build` followed by `npm start` behind a proxy/load balancer configured to forward WebSocket upgrades. Set `REDIS_URL` in `.env` to enable Redis pub/sub for multi-instance deployments; without it, the relay stays in-memory and is intended for a single app server.

Administrators can configure the timezone, scheduled workdays, and shift start/end from **Configuration** in the account menu. The account menu is beside the signed-in user's profile at the bottom of the sidebar; administrators see **Configuration**, and every role can log out. Clock-ins after the configured start time are marked late, clock-out is blocked until the configured end time, and clock-in is blocked on unscheduled days. Employees start and end their own breaks; the actual recorded break duration is deducted from gross punch time. This break policy is fixed for this release. Manager-approved punch corrections follow the same configured timezone and shift rules.

Overtime is calculated automatically as time after the configured shift end. Only the portion of a recorded break interval that overlaps the overtime period is deducted. Break intervals are captured for new breaks, and existing break start/end audit events are backfilled by the migration. Reports and CSV exports include overtime totals.

## Operational notes

- The initial release supports one attendance entry per employee per local work date. Overnight shifts, holiday calendars, automated overtime rules, password reset, email notifications, bulk import, and PDF export are not implemented yet.
- Managers see only assigned team members. The administrator can review organization-wide records and create employees/managers.
- Configure HTTPS, secure secret storage, scheduled PostgreSQL backups, retention, and access policy before deploying with real employee information.
