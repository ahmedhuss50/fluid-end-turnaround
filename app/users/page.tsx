import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/role";
import { fmtDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtAgo(d: Date | null): string {
  if (!d) return "Never";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export default async function UsersPage() {
  // PSI-only.
  if (getRole() === "client") redirect("/requests");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [users, recentLogins] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { name: "asc" }] }),
    prisma.loginEvent.groupBy({
      by: ["userId"],
      where: { at: { gte: weekAgo } },
      _count: { _all: true },
      _max: { at: true },
    }),
  ]);

  const byUser = new Map(recentLogins.map((r) => [r.userId, { count: r._count._all, last: r._max.at }]));
  const activeThisWeek = users.filter((u) => byUser.has(u.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users &amp; access</h1>
          <p>Who has an account, and who has signed in recently.</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat accent">
          <div className="k">Signed in this week</div><div className="v">{activeThisWeek.length}</div><div className="sub">of {users.length} users</div>
        </div>
        <div className="stat">
          <div className="k">Sign-ins (last 7 days)</div><div className="v">{recentLogins.reduce((s, r) => s + r._count._all, 0)}</div><div className="sub">total logins</div>
        </div>
        <div className="stat">
          <div className="k">Never signed in</div><div className="v">{users.filter((u) => !u.lastLoginAt).length}</div><div className="sub">yet to log in</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Signed in — last 7 days</h2>
          <span className="badge completed"><span className="d" />{activeThisWeek.length} active</span>
        </div>
        {activeThisWeek.length === 0 ? (
          <div className="empty"><div>No sign-ins in the last 7 days.</div></div>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Logins (7d)</th><th>Last sign-in</th></tr>
            </thead>
            <tbody>
              {activeThisWeek.map((u) => {
                const info = byUser.get(u.id)!;
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="mono small">{u.email}</td>
                    <td className="small">{u.role === "psi" ? "PSI" : "Client"}</td>
                    <td>{info.count}</td>
                    <td className="small muted">{info.last ? fmtDateTime(info.last) : fmtDateTime(u.lastLoginAt)} <span style={{ color: "var(--muted)" }}>· {fmtAgo(info.last || u.lastLoginAt)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>All users ({users.length})</h2></div>
        <table className="grid">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Password set</th><th>Last sign-in</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="mono small">{u.email}</td>
                <td className="small">{u.role === "psi" ? "PSI" : "Client"}</td>
                <td>
                  {u.mustChangePassword
                    ? <span className="badge awaiting"><span className="d" />Temporary</span>
                    : <span className="badge completed"><span className="d" />Changed</span>}
                </td>
                <td className="small muted">
                  {u.lastLoginAt ? <>{fmtDateTime(u.lastLoginAt)} <span>· {fmtAgo(u.lastLoginAt)}</span></> : <span className="muted">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
