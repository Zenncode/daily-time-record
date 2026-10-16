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
- Timezone-aware work dates and display, configurable with `APP_TIMEZONE`
- Audit events for punches, break actions, account changes, and correction reviews
- Responsive desktop/mobile interface

## Run locally

Requirements: Node.js 20+, npm, and PostgreSQL.

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters), and a strong `ADMIN_PASSWORD` (at least 12 characters).
2. Install dependencies: `npm install`.
3. Create the database schema: `npx prisma migrate dev --name init`.
4. Create the first administrator: `npm run db:seed`.
5. Start the app: `npm run dev`.
6. Open `http://localhost:3000` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

The seed command creates the initial administrator only if that email does not already exist; it does not reset an existing password. Set `APP_TIMEZONE` to an IANA timezone such as `Asia/Manila` or `America/Los_Angeles`.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Operational notes

- The initial release supports one attendance entry per employee per local work date. Overnight shifts, configurable shift schedules, holiday calendars, automated overtime rules, password reset, email notifications, bulk import, and PDF export are not implemented yet.
- Managers see only assigned team members. The administrator can review organization-wide records and create employees/managers.
- Configure HTTPS, secure secret storage, scheduled PostgreSQL backups, retention, and access policy before deploying with real employee information.
