"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { ROLES, ROLE_BLURB, ROLE_LABEL, mayGrant, type Role } from "@/lib/auth/roles";
import { addPerson, changeMyPassword, removePerson, resetPassword, setPersonRole } from "@/lib/auth/people-actions";

/**
 * The people in a workspace (§5.46).
 *
 * Until now everybody who could sign in could do everything, so this page had nothing to show. Now
 * a role means something, and the screen has one job beyond listing names: making the meaning of
 * each role legible *at the point of choosing it*, because "Member" and "Administrator" are words
 * every product uses differently and nobody reads the documentation to find out which.
 *
 * Everything here is also enforced on the server. A hidden button is a courtesy to somebody who
 * cannot use it, never the thing that stops them.
 */

export interface Person {
  userId: string;
  name: string;
  email: string;
  color: string;
  role: Role;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export function People({ slug, workspaceId, people, myUserId, myRole, canManage }: {
  slug: string;
  workspaceId: string;
  people: Person[];
  myUserId: string;
  myRole: Role | null;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: true; error?: string } | { error: string } | unknown>, done?: () => void) =>
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      setMessage(r && "error" in r && r.error ? r.error : null);
      if (!(r && "error" in r && r.error)) done?.();
    });

  return (
    <section className="studio-home-main" aria-label="People">
      <header className="studio-home-topbar">
        <div>
          <span>Who is in this workspace</span>
          <h1>People</h1>
          <p className="roadmap-lede">
            Everybody here signs in as themselves. What each of them may do is a role, and the roles
            mean what the list below says they mean — approving an import or issuing a key changes the
            model everybody else is reading, so those are an administrator&apos;s.
          </p>
        </div>
        {canManage && (
          <button type="button" className="primary-home-button" onClick={() => setAdding((v) => !v)} data-add-person>
            <UserPlus size={14} /> Add somebody
          </button>
        )}
      </header>

      {message && <p className="form-error" data-people-error>{message}</p>}

      {adding && canManage && <AddPerson workspaceId={workspaceId} myRole={myRole} pending={pending} onDone={() => setAdding(false)} run={run} />}

      <ul className="people-list" data-people>
        {people.map((p) => (
          <li key={p.userId} data-person={p.userId}>
            <span className="people-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
            <div className="people-who">
              <b>{p.name}{p.userId === myUserId && <em> — you</em>}</b>
              <small>{p.email}</small>
            </div>
            {canManage && p.userId !== myUserId ? (
              <select
                className="people-role"
                value={p.role}
                disabled={pending}
                aria-label={`Role for ${p.name}`}
                onChange={(e) => run(() => setPersonRole(workspaceId, p.userId, e.target.value))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} disabled={!mayGrant(myRole, r)}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            ) : (
              <span className={`people-role-chip ${p.role}`}>{ROLE_LABEL[p.role]}</span>
            )}
            {canManage && (
              <div className="people-actions">
                <button type="button" title="Set a new password" aria-label={`Reset the password for ${p.name}`} disabled={pending} onClick={() => setResetting(resetting === p.userId ? null : p.userId)}>
                  <KeyRound size={14} />
                </button>
                {p.userId !== myUserId && (
                  <button
                    type="button"
                    className="danger"
                    title="Remove from this workspace"
                    aria-label={`Remove ${p.name}`}
                    disabled={pending}
                    onClick={() => { if (confirm(`Remove ${p.name} from this workspace? Everything they made stays.`)) run(() => removePerson(workspaceId, p.userId)); }}
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            )}
            {resetting === p.userId && canManage && (
              <form
                className="people-reset"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get("password");
                  run(() => resetPassword(workspaceId, p.userId, String(value ?? "")), () => setResetting(null));
                }}
              >
                <input name="password" type="password" placeholder="New password, at least 10 characters" minLength={10} required aria-label={`New password for ${p.name}`} />
                <button type="submit" className="ghost-button" disabled={pending}>Set it</button>
                <small>Ends every session they have open.</small>
              </form>
            )}
          </li>
        ))}
      </ul>

      <section className="people-roles" aria-label="What the roles mean">
        <h2><ShieldCheck size={14} /> What the roles mean</h2>
        <dl>
          {ROLES.map((r) => (
            <div key={r}>
              <dt>{ROLE_LABEL[r]}</dt>
              <dd>{ROLE_BLURB[r]}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          There is no sign-up and no forgotten-password email on purpose: single sign-on is the intended
          answer to both, and a mail transport in the middle of an architecture tool is a moving part
          nobody asked for. Until then, somebody here adds the row.
        </p>
      </section>

      <MyPassword slug={slug} />
    </section>
  );
}

function AddPerson({ workspaceId, myRole, pending, onDone, run }: {
  workspaceId: string;
  myRole: Role | null;
  pending: boolean;
  onDone: () => void;
  run: (fn: () => Promise<unknown>, done?: () => void) => void;
}) {
  return (
    <form
      className="people-add"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => addPerson({ workspaceId, name: String(f.get("name") ?? ""), email: String(f.get("email") ?? ""), role: String(f.get("role") ?? "member"), password: String(f.get("password") ?? "") }),
          onDone,
        );
      }}
    >
      <label><span>Name</span><input name="name" required placeholder="Maria Lund" /></label>
      <label><span>Email</span><input name="email" type="email" required placeholder="maria@acme-energy.example" /></label>
      <label>
        <span>Role</span>
        <select name="role" defaultValue="member">
          {ROLES.map((r) => <option key={r} value={r} disabled={!mayGrant(myRole, r)}>{ROLE_LABEL[r]}</option>)}
        </select>
      </label>
      <label><span>First password</span><input name="password" type="password" minLength={10} required placeholder="At least 10 characters" /></label>
      <div className="people-add-actions">
        <button type="submit" className="primary-home-button" disabled={pending}>Add them</button>
        <button type="button" className="ghost-button" onClick={onDone}>Cancel</button>
        <small>Tell them the password yourself; they can change it on this page.</small>
      </div>
    </form>
  );
}

/** Anybody, for themselves. The one account action that needs no administrator. */
function MyPassword({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  void slug;
  return (
    <section className="people-mine" aria-label="Your password">
      <h2><KeyRound size={14} /> Your password</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          start(async () => {
            const r = await changeMyPassword(String(f.get("current") ?? ""), String(f.get("next") ?? ""));
            setNote("error" in r ? r.error : "Changed. Your other sessions have been signed out.");
            if (!("error" in r)) form.reset();
          });
        }}
      >
        <input name="current" type="password" required placeholder="Current password" aria-label="Current password" />
        <input name="next" type="password" minLength={10} required placeholder="New password, at least 10 characters" aria-label="New password" />
        <button type="submit" className="ghost-button" disabled={pending} data-change-password>Change it</button>
      </form>
      {note && <small className="people-note">{note}</small>}
    </section>
  );
}
