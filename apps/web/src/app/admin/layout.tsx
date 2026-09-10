import { notFound } from "next/navigation";
import Link from "next/link";
import { operatorOrNull } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * The platform console's shell (§5.64).
 *
 * `notFound` rather than a refusal, for the same reason the workspace layout does it: somebody who
 * is not an operator should not learn from a URL that a console exists, still less that their own
 * account nearly qualifies. To everybody else this route is a page that is not there.
 *
 * Deliberately outside `/w/[slug]`: this console is not *in* a tenant, and rendering it inside a
 * workspace sidebar would suggest it belongs to whichever one you happened to be looking at.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await operatorOrNull();
  if (!me) notFound();
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <Link href="/" className="admin-back">Nexus</Link>
          <b>Platform</b>
          <span>Everything on this deployment. You are outside the tenants here, not inside one.</span>
        </div>
        <div className="admin-who">
          <em>{me.name}</em>
          <span>Operator</span>
        </div>
      </header>
      <AdminNav />
      {children}
    </main>
  );
}
