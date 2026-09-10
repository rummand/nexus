"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, KeyRound, LogOut, Plus, Shield, Trash2, UserPlus } from "lucide-react";
import {
  createAccount, deleteAccount, endSessions, removeMembership, setMembership, setPassword, setPlatformRole,
} from "@/lib/admin/actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/auth/roles";
import type { Account } from "@/lib/admin/platform";

/**
 * Every account on the platform (§5.64).
 *
 * The workspace People page answers "who is in this workspace". This answers the questions that
 * page cannot: who has an account at all, who is in *nothing* and therefore signs in to an empty
 * home, who cannot sign in because they have no password, and who is signed in right now.
 *
 * Setting a password is the reason this console was asked for, and it does the thing that makes
 * it mean something: every session that person has ends with it.
 */
export function Accounts({ accounts, tenants, myUserId }: {
  accounts: Account[];
  tenants: Array<{ id: string; slug: string; name: string }>;
  myUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [joinTenant, setJoinTenant] = useState(tenants[0]?.id ?? "");
  const [joinRole, setJoinRole] = useState<Role>("member");

  const run = (fn: () => Promise<{ error: string } | { ok: true } | { ok: true; userId: string }>, said?: string) => {
    setError(null);
    setNote(null);
    start(async () => {
      const result = await fn();
      if ("error" in result) { setError(result.error); return; }
      if (said) setNote(said);
      router.refresh();
    });
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      || a.memberships.some((m) => m.name.toLowerCase().includes(q) || m.slug.includes(q)));
  }, [accounts, query]);

  return (
    <section className="admin-main" aria-label="People">
      <header className="admin-head">
        <h1>People</h1>
        <input
          className="admin-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name, an address or a tenant"
          aria-label="Search people"
          data-admin-search
        />
        <button type="button" className="primary-home-button" onClick={() => setAdding((v) => !v)} data-new-account>
          <Plus size={15} /> New account
        </button>
      </header>

      {adding && (
        <div className="admin-new" data-new-account-form>
          <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jesper Olesen" data-account-name /></label>
          <label><span>Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jesper@example.com" data-account-email /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" data-account-password /></label>
          <button
            type="button"
            className="primary-home-button"
            disabled={pending || !name.trim() || !email.trim() || !password}
            data-create-account
            onClick={() => run(async () => {
              const r = await createAccount({ name, email, password });
              if ("ok" in r) { setName(""); setEmail(""); setPw(""); setAdding(false); }
              return r;
            }, "Account created. It belongs to no tenant yet — put it in one below.")}
          >
            {pending ? "Creating…" : "Create"}
          </button>
          <span className="admin-hint">
            The account exists on the platform, not in a tenant. Give it a membership and it has
            somewhere to go; leave it and it signs in to an empty home.
          </span>
        </div>
      )}

      {error && <p className="form-error" data-admin-error><AlertTriangle size={13} /> {error}</p>}
      {note && <p className="admin-note" data-admin-note><Check size={13} /> {note}</p>}

      <ul className="admin-accounts" data-admin-accounts>
        {shown.map((a) => (
          <li key={a.id} className="admin-account" data-admin-account={a.email}>
            <div className="admin-account-head">
              <div className="admin-account-who">
                <b>{a.name}</b>
                <span>{a.email}</span>
              </div>
              <div className="admin-account-flags">
                {a.platformRole === "operator" && <em className="admin-flag operator"><Shield size={11} /> Operator</em>}
                {!a.signsIn && <em className="admin-flag warn">No password</em>}
                {a.memberships.length === 0 && <em className="admin-flag quiet">In no tenant</em>}
                {a.sessions > 0 && <em className="admin-flag live">{a.sessions} signed in</em>}
              </div>
              <button
                type="button"
                className="ghost-button"
                data-manage-account
                onClick={() => { setOpen(open === a.id ? null : a.id); setNewPassword(""); setConfirm(""); }}
              >
                <KeyRound size={14} /> Manage
              </button>
            </div>

            <div className="admin-memberships">
              {a.memberships.length === 0 && <i>Belongs to no tenant.</i>}
              {a.memberships.map((m) => (
                <span key={m.workspaceId} className="admin-membership" data-membership={m.slug}>
                  <b>{m.name}</b>
                  <select
                    value={m.role}
                    aria-label={`${a.name} in ${m.name}`}
                    data-membership-role
                    onChange={(e) => run(() => setMembership(m.workspaceId, a.id, e.target.value))}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name} from ${m.name}`}
                    data-remove-membership
                    onClick={() => run(() => removeMembership(m.workspaceId, a.id), `${a.name} removed from ${m.name}.`)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {open === a.id && (
              <div className="admin-account-manage" data-account-manage>
                <div className="admin-manage-row">
                  <label>
                    <span>Set a password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 10 characters"
                      data-new-password
                    />
                  </label>
                  <button
                    type="button"
                    className="primary-home-button"
                    disabled={pending || newPassword.length < 10}
                    data-set-password
                    onClick={() => run(async () => {
                      const r = await setPassword(a.id, newPassword);
                      if ("ok" in r) setNewPassword("");
                      return r;
                    }, `${a.name} has a new password, and every session they had has ended.`)}
                  >
                    Set it
                  </button>
                  <span className="admin-hint">Every session they have ends with it. That is the point of setting one.</span>
                </div>

                <div className="admin-manage-row">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={pending || a.sessions === 0}
                    data-end-sessions
                    onClick={() => run(() => endSessions(a.id), `${a.name} signed out everywhere.`)}
                  >
                    <LogOut size={14} /> Sign out everywhere{a.sessions ? ` (${a.sessions})` : ""}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={pending}
                    data-toggle-operator
                    onClick={() => run(
                      () => setPlatformRole(a.id, a.platformRole !== "operator"),
                      a.platformRole === "operator" ? `${a.name} is no longer an operator.` : `${a.name} can now run the platform.`,
                    )}
                  >
                    <Shield size={14} /> {a.platformRole === "operator" ? "Remove operator" : "Make operator"}
                  </button>
                </div>

                <div className="admin-manage-row">
                  <label>
                    <span>Add to a tenant</span>
                    <select value={joinTenant} onChange={(e) => setJoinTenant(e.target.value)} aria-label="Which tenant" data-join-tenant>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>As</span>
                    <select value={joinRole} onChange={(e) => setJoinRole(e.target.value as Role)} aria-label="With which role" data-join-role>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={pending || !joinTenant}
                    data-add-membership
                    onClick={() => run(() => setMembership(joinTenant, a.id, joinRole), `${a.name} added.`)}
                  >
                    <UserPlus size={14} /> Add
                  </button>
                </div>

                {a.id !== myUserId && (
                  <div className="admin-danger">
                    <p>
                      Deleting <b>{a.name}</b> ends their access. What they made — boards, versions,
                      comments, change sets — stays, because the record of what happened is not
                      theirs to take with them. Type <code>{a.email}</code> to confirm.
                    </p>
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={a.email}
                      aria-label="Type the email to confirm"
                      data-confirm-email
                    />
                    <button
                      type="button"
                      className="danger-button"
                      disabled={pending || confirm.trim().toLowerCase() !== a.email}
                      data-confirm-delete-account
                      onClick={() => run(async () => {
                        const r = await deleteAccount(a.id, confirm);
                        if ("ok" in r) { setOpen(null); setConfirm(""); }
                        return r;
                      }, `${a.name} deleted.`)}
                    >
                      <Trash2 size={14} /> Delete this account
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
