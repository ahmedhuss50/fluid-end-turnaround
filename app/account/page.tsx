import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { changePassword } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing: "Fill in all three fields.",
  short: "Your new password must be at least 8 characters.",
  mismatch: "The new password and confirmation don't match.",
  current: "Your current password is incorrect.",
  same: "Your new password must be different from your current one.",
};

export default function AccountPage({ searchParams }: { searchParams: { error?: string; changed?: string } }) {
  const session = getSession();
  if (!session) redirect("/login");

  const error = searchParams.error ? ERRORS[searchParams.error] || "Something went wrong." : null;
  const changed = searchParams.changed === "1";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Your profile and password.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head"><h2>Profile</h2></div>
        <div className="card-body">
          <dl className="kv">
            <dt>Name</dt><dd>{session.name}</dd>
            <dt>Email</dt><dd className="mono">{session.email}</dd>
            <dt>Role</dt><dd>{session.role === "psi" ? "PSI staff" : "Client (operator)"}</dd>
            {session.company && (<><dt>Company</dt><dd>{session.company}</dd></>)}
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Change password</h2></div>
        <div className="card-body">
          {changed && (
            <div className="callout green" style={{ marginBottom: 16 }}><span><strong>Password updated.</strong> Use your new password next time you sign in.</span></div>
          )}
          {error && (
            <div className="callout amber" style={{ marginBottom: 16 }}><span>{error}</span></div>
          )}
          <form action={changePassword} className="stack" style={{ maxWidth: 420 }}>
            <div className="field">
              <label>Current password <span className="req">*</span></label>
              <input type="password" name="current" required autoComplete="current-password" placeholder="••••••••" />
            </div>
            <div className="field">
              <label>New password <span className="req">*</span></label>
              <input type="password" name="next" required autoComplete="new-password" placeholder="At least 8 characters" />
            </div>
            <div className="field">
              <label>Confirm new password <span className="req">*</span></label>
              <input type="password" name="confirm" required autoComplete="new-password" placeholder="Re-enter new password" />
            </div>
            <div className="wrap-actions">
              <button type="submit" className="btn">Update password</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
