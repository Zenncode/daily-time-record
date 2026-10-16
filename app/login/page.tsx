import { loginAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Clock3, Leaf, ShieldCheck } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  return <main className="login-screen">
    <section className="login-art"><div className="brand" style={{ padding: 0, color: "#fff" }}><span className="brand-mark" style={{ color: "var(--green)", background: "#fff" }}><Leaf size={18} /></span><span>daymark<small style={{ color: "#c5dfd1" }}>TIME & ATTENDANCE</small></span></div><h1>Every hour, accounted for.</h1><p>A thoughtful, transparent way to keep your workday and your team in sync.</p><div style={{ display: "flex", gap: 22, marginTop: 24, color: "#d8ebe0", fontSize: 12 }}><span><Clock3 size={14} style={{ verticalAlign: "-3px", marginRight: 6 }} />Simple time tracking</span><span><ShieldCheck size={14} style={{ verticalAlign: "-3px", marginRight: 6 }} />Secure by design</span></div></section>
    <section className="login-panel"><div className="login-form"><h2>Welcome back</h2><p>Sign in to your account to continue.</p>{error && <div className="notice notice-error">Email or password is incorrect, or this account is inactive.</div>}
      <form action={loginAction}>
        <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div>
        <button className="button button-primary">Sign in</button>
      </form>
      <div className="form-note">Your organization administrator creates your account.<br />Contact them if you need access or password assistance.</div>
    </div></section>
  </main>;
}
