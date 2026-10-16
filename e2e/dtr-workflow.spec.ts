import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type Page } from "@playwright/test";

const db = new PrismaClient();
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const managerEmail = `e2e-manager-${runId}@example.test`;
const employeeEmail = `e2e-employee-${runId}@example.test`;
const managerName = `E2E Manager ${runId}`;
const employeeName = `E2E Employee ${runId}`;
const testPassword = `E2e-${runId}-Secure!`;

test.afterAll(async () => {
  try {
    await db.user.deleteMany({ where: { email: { in: [managerEmail, employeeEmail] } } });
  } finally {
    await db.$disconnect();
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function employeeWorkflow(browser: Browser, onClockIn: () => Promise<void>) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, employeeEmail, testPassword);

  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByRole("button", { name: "Start break" })).toBeVisible();
  await onClockIn();
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByText("Clock out is available at 5:00 PM or later.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock out" })).toBeVisible();
  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByRole("button", { name: "End break" })).toBeVisible();
  await page.getByRole("button", { name: "End break" }).click();
  await expect(page.getByRole("button", { name: "Start break" })).toBeVisible();

  await page.goto("/attendance");
  const attendanceRow = page.getByRole("row").nth(1);
  await expect(attendanceRow).toContainText("Late");
  await attendanceRow.getByText("Request change").click();
  await attendanceRow.getByLabel("What needs correcting?").selectOption("BREAK_TOTAL");
  await attendanceRow.getByLabel("Break minutes (if correcting break)").fill("15");
  await attendanceRow.getByLabel("Reason").fill("Correcting break time for E2E verification.");
  await attendanceRow.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Your correction request was sent to your manager.")).toBeVisible();

  return { context, page };
}

test("admin, employee and manager complete the DTR correction workflow", async ({ browser, page }) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for E2E tests.");

  await signIn(page, adminEmail, adminPassword);
  await page.goto("/employees");

  await page.getByLabel("Full name").fill(managerName);
  await page.getByLabel("Work email").fill(managerEmail);
  await page.getByLabel("Temporary password").fill(testPassword);
  await page.getByLabel("Role", { exact: true }).selectOption("MANAGER");
  await page.getByRole("button", { name: "Create employee" }).click();
  await expect(page.getByText(managerEmail)).toBeVisible();

  await page.getByLabel("Full name").fill(employeeName);
  await page.getByLabel("Work email").fill(employeeEmail);
  await page.getByLabel("Temporary password").fill(testPassword);
  await page.getByLabel("Role", { exact: true }).selectOption("EMPLOYEE");
  await page.getByLabel("Manager").selectOption({ label: managerName });
  await page.getByRole("button", { name: "Create employee" }).click();
  await expect(page.getByText(employeeEmail)).toBeVisible();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  let employeeContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let employeePage: Page | undefined;
  try {
    await signIn(managerPage, managerEmail, testPassword);
    ({ context: employeeContext, page: employeePage } = await employeeWorkflow(browser, async () => {
      const liveRow = managerPage.getByRole("row").filter({ hasText: employeeName });
      await expect(liveRow).toBeVisible();
      await expect(liveRow).toContainText("Late");
      await expect(liveRow).toContainText("In progress");
    }));

    await managerPage.goto("/requests");
    const requestRow = managerPage.getByRole("row").filter({ hasText: employeeName });
    await expect(requestRow).toContainText("15 minutes");
    await requestRow.getByRole("button", { name: "Approve" }).click();
    await expect(managerPage.getByText("Request reviewed successfully.")).toBeVisible();
    await expect(managerPage.getByRole("row").filter({ hasText: employeeName })).toContainText("approved");

    await managerPage.goto("/reports");
    const reportRow = managerPage.getByRole("row").filter({ hasText: employeeName });
    await expect(reportRow).toBeVisible();
    await expect(reportRow).toContainText("15m");

    await employeePage.goto("/attendance");
    const correctedRow = employeePage.getByRole("row").nth(1);
    await expect(correctedRow).toContainText("15m");
  } finally {
    await managerContext.close();
    await employeeContext?.close();
  }
});

test("rejects invalid credentials without creating a session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`missing-${runId}@example.test`);
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect, or this account is inactive.")).toBeVisible();
  await expect(page).toHaveURL(/\/login\?error=invalid$/);
});
