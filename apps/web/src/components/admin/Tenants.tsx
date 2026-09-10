"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Check, Database, Plus, Trash2 } from "lucide-react";
import { createTenant, deleteTenant, readdressTenant, renameTenant } from "@/lib/admin/actions";
import { deletionCost, slugify, stateWhy, tenantState, type Tenant, type Totals } from "@/lib/admin/platform";
import type { Deployment } from "@/lib/admin/read";

/**
 * The customers, as one screen (§5.64).
 *
 * Sorted by size rather than by name, because the question an operator opens this with is "who is
 * actually using it" and an alphabetical list buries that under whoever is called Acme. Each row
 * carries its own state — empty, dormant, in use — with the reason in words, so the list answers
 * "which of these needs me" without opening any of them.
 */

const STATE: Record<ReturnType<typeof tenantState>, string> = {
  empty: "empty",
  dormant: "dormant",
  active: "in use",
};

export function Tenants({ tenants, totals, deployment, people }: {
  tenants: Tenant[];
  totals: Totals;
  deployment: Deployment;
  people: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerId, setOwnerId] = useState(people[0]?.id ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const run = (fn: () => Promise<{ error: string } | { ok: true } | { ok: true; slug: string }>, said?: string) => {
    setError(null);
    setNote(null);
    start(async () => {
      const result = await fn();
      if ("error" in result) { setError(result.error); return; }
      if (said) setNote(said);
      router.refresh();
    });
  };

  return (
    <section className="admin-main" aria-label="Tenants">
      <div className="admin-totals" data-admin-totals>
        <b>{totals.tenants}</b><span>tenant{totals.tenants === 1 ? "" : "s"}</span>
        <b>{totals.people}</b><span>people</span>
        <b>{totals.boards}</b><span>boards</span>
        <b>{totals.entities.toLocaleString()}</b><span>objects</span>
        <b>{totals.relations.toLocaleString()}</b><span>relations</span>
        <b>{totals.sessions}</b><span>signed in</span>
      </div>

      <p className="admin-deployment" data-admin-deployment>
        <Database size={13} />
        <span>
          {deployment.dialect === "postgres" ? "Postgres" : "SQLite"} · model{" "}
          {deployment.modelProvider ?? "not configured"}
          {deployment.leanIxGateway ? " · LeanIX behind a gateway" : ""}
          {deployment.ownerBootstrap ? ` · owner bootstrap ${deployment.ownerBootstrap}` : ""}
          {" · Node "}{deployment.node}
        </span>
      </p>

      <header className="admin-head">
        <h1>Tenants</h1>
        <button type="button" className="primary-home-button" onClick={() => setAdding((v) => !v)} data-new-tenant>
          <Plus size={15} /> New tenant
        </button>
      </header>

      {adding && (
        <div className="admin-new" data-new-tenant-form>
          <label>
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (!slug) setSlug(""); }}
              placeholder="Nordic Grid"
              data-tenant-name
            />
          </label>
          <label>
            <span>Address</span>
            <input
              value={slug || slugify(name)}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="nordic-grid"
              data-tenant-slug
            />
          </label>
          <label>
            <span>First owner</span>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} data-tenant-owner>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="primary-home-button"
            disabled={pending || !name.trim() || !ownerId}
            data-create-tenant
            onClick={() => run(async () => {
              const r = await createTenant({ name, slug: slug || slugify(name), ownerId });
              if ("ok" in r) { setName(""); setSlug(""); setAdding(false); }
              return r;
            }, "Tenant created, with one owner and one space to put boards in.")}
          >
            {pending ? "Creating…" : "Create"}
          </button>
          <span className="admin-hint">
            It gets one owner and one space. Everything else is theirs to decide — an empty tenant
            is honest, a pre-furnished one is a guess.
          </span>
        </div>
      )}

      {error && <p className="form-error" data-admin-error><AlertTriangle size={13} /> {error}</p>}
      {note && <p className="admin-note" data-admin-note><Check size={13} /> {note}</p>}

      <ul className="admin-tenants" data-admin-tenants>
        {tenants.map((t) => {
          const state = tenantState(t);
          return (
            <li key={t.id} className={`admin-tenant ${state}`} data-admin-tenant={t.slug}>
              <div className="admin-tenant-head">
                <Building2 size={15} />
                <input
                  className="admin-tenant-name"
                  defaultValue={t.name}
                  aria-label={`Name of ${t.slug}`}
                  data-rename-tenant
                  onBlur={(e) => { if (e.target.value.trim() !== t.name) run(() => renameTenant(t.id, e.target.value)); }}
                />
                <input
                  className="admin-tenant-slug"
                  defaultValue={t.slug}
                  aria-label={`Address of ${t.slug}`}
                  data-readdress-tenant
                  onBlur={(e) => { if (e.target.value.trim() !== t.slug) run(() => readdressTenant(t.id, e.target.value)); }}
                />
                <em className={`admin-state ${state}`} title={stateWhy(t)}>{STATE[state]}</em>
                <Link href={`/w/${t.slug}`} className="ghost-button">Open</Link>
                <button
                  type="button"
                  className="ghost-button danger"
                  data-delete-tenant
                  onClick={() => { setOpen(open === t.id ? null : t.id); setConfirm(""); }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="admin-tenant-counts">
                <span>{t.people} {t.people === 1 ? "person" : "people"}</span>
                <span>{t.owners} owner{t.owners === 1 ? "" : "s"}</span>
                <span>{t.boards} boards</span>
                <span>{t.entities.toLocaleString()} objects</span>
                <span>{t.relations.toLocaleString()} relations</span>
                <i>{stateWhy(t)}</i>
              </div>
              {open === t.id && (
                <div className="admin-danger" data-delete-confirm>
                  <p>
                    Deleting <b>{t.name}</b> deletes {deletionCost(t)}. It cannot be undone from
                    here. Type <code>{t.slug}</code> to confirm.
                  </p>
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder={t.slug}
                    aria-label="Type the address to confirm"
                    data-confirm-slug
                  />
                  <button
                    type="button"
                    className="danger-button"
                    disabled={pending || confirm !== t.slug}
                    data-confirm-delete
                    onClick={() => run(async () => {
                      const r = await deleteTenant(t.id, confirm);
                      if ("ok" in r) { setOpen(null); setConfirm(""); }
                      return r;
                    }, `${t.name} deleted.`)}
                  >
                    Delete this tenant
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
