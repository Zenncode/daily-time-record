import { createEmployeeAction, setEmployeeActiveAction } from "@/app/actions/users";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const employees = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      active: true,
      manager: { select: { name: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 250,
  });
  const managers = employees.filter((employee) => employee.active && employee.role === "MANAGER");
  const errorMessage = params.error === "email-in-use" ? "That email is already registered."
    : params.error === "invalid-manager" ? "Choose an active manager."
    : params.error ? "Check the employee details and try again." : null;
  return <main className="page">
    <div className="page-heading"><div><p className="eyebrow">ORGANIZATION</p><h1>Employees</h1><p className="subtitle">Manage team members and their access to Daymark.</p></div></div>
    {errorMessage && <div className="notice notice-error">{errorMessage}</div>}
    {params.success && <div className="notice notice-success">Employee information updated.</div>}
    <div className="grid dashboard-grid">
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Team directory</h2><p className="card-description">{employees.length} accounts shown (up to 250).</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Manager</th><th>Account</th><th></th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}>
          <td><div className="cell-primary">{employee.name}</div><div className="cell-secondary">{employee.email}</div></td>
          <td style={{ textTransform: "capitalize" }}>{employee.role.toLowerCase()}</td><td>{employee.department || "—"}</td><td>{employee.manager?.name || "—"}</td>
          <td><span className={`status-pill ${employee.active ? "" : "status-rejected"}`}>{employee.active ? "Active" : "Inactive"}</span></td>
          <td>{employee.role !== "ADMIN" && <form action={setEmployeeActiveAction}><input type="hidden" name="userId" value={employee.id} /><input type="hidden" name="active" value={String(!employee.active)} /><button className={`button button-small ${employee.active ? "button-outline" : "button-primary"}`}>{employee.active ? "Deactivate" : "Activate"}</button></form>}</td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="card">
        <div className="card-header"><div><h2 className="card-title">Add a team member</h2><p className="card-description">Create an account with a temporary password.</p></div></div>
        <form action={createEmployeeAction} className="grid" style={{ gap: 13 }}>
          <div className="field"><label htmlFor="name">Full name</label><input className="input" id="name" name="name" minLength={2} maxLength={100} required /></div>
          <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" maxLength={254} required /></div>
          <div className="field"><label htmlFor="password">Temporary password</label><input className="input" id="password" name="password" type="password" minLength={12} maxLength={128} required /><span className="cell-secondary">At least 12 characters; share securely.</span></div>
          <div className="field"><label htmlFor="role">Role</label><select className="select" id="role" name="role"><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option></select></div>
          <div className="field"><label htmlFor="department">Department</label><input className="input" id="department" name="department" maxLength={100} /></div>
          <div className="field"><label htmlFor="managerId">Manager</label><select className="select" id="managerId" name="managerId"><option value="">No manager assigned</option>{managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.name}</option>)}</select></div>
          <button className="button button-primary" style={{ marginTop: 3 }}>Create employee</button>
        </form>
      </section>
    </div>
  </main>;
}
