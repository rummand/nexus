import { accounts, deployment, tenants } from "@/lib/admin/read";
import { totals } from "@/lib/admin/platform";
import { Tenants } from "@/components/admin/Tenants";

/** Every customer on this deployment, what is in them, and which ones need somebody (§5.64). */
export default async function TenantsPage() {
  const [rows, people] = await Promise.all([tenants(), accounts()]);
  return (
    <Tenants
      tenants={rows}
      totals={totals(rows, people)}
      deployment={deployment()}
      people={people.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
    />
  );
}
