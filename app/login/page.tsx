import { login } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error =
    searchParams.error === "invalid"
      ? "That email and password don't match an account."
      : searchParams.error === "missing"
      ? "Enter your email and password."
      : null;

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="authbrand">
          <span className="word">PSI Portal</span>
          <span className="sub">Fluid End Work Orders</span>
        </div>
        <h1 className="authtitle">Sign in</h1>
        <p className="authlede">Enter your credentials to access the portal.</p>

        {error && <div className="callout amber" style={{ marginBottom: 14 }}><span>{error}</span></div>}

        <form action={login} className="stack">
          <div className="field">
            <label>Email</label>
            <input type="email" name="email" required autoComplete="username" placeholder="you@company.com" autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" name="password" required autoComplete="current-password" placeholder="••••••••" />
          </div>
          <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }}>Sign in →</button>
        </form>
      </div>
      <div className="authfoot">PSI Fluid End Work Order System</div>
    </div>
  );
}
