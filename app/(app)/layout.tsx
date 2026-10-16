import Link from "next/link";
import { CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Users, Leaf, BarChart3 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";
import RealtimeUpdates from "@/app/(app)/realtime-updates";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireSession();
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
    { href: "/attendance", label: "My attendance", icon: CalendarDays, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
    { href: "/requests", label: "Approvals", icon: ClipboardCheck, roles: ["ADMIN", "MANAGER"] },
    { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
    { href: "/employees", label: "Employees", icon: Users, roles: ["ADMIN"] },
  ].filter((link) => link.roles.includes(user.role));
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark"><Leaf size={18} /></span>
          <span>daymark<small>TIME & ATTENDANCE</small></span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-links">
          {links.map(({ href, label, icon: Icon }) => (
            <Link href={href} className="nav-link" key={href}><Icon size={17} strokeWidth={1.8} />{label}</Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile"><div className="avatar">{initials}</div><div><div className="profile-name">{user.name}</div><div className="profile-role">{user.role.toLowerCase()}</div></div></div>
          <form action={logoutAction}><button className="nav-link" style={{ width: "100%", border: 0, background: "transparent" }}><LogOut size={16} />Sign out</button></form>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar"><div className="crumb">Workspace <span style={{ padding: "0 7px", color: "#c2cbc5" }}>/</span> {user.role === "EMPLOYEE" ? "My time" : "Attendance management"}</div><div className="topbar-right"><RealtimeUpdates /><span className="avatar" style={{ width: 29, height: 29, fontSize: 10 }}>{initials}</span></div></header>
        {children}
      </div>
    </div>
  );
}
