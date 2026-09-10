import { accounts, tenants } from "@/lib/admin/read";
import { operatorOrNull } from "@/lib/admin/guard";
import { Accounts } from "@/components/admin/Accounts";

/** Every account on the platform, whichever tenants it belongs to (§5.64). */
export default async function PeoplePage() {
  const [rows, spaces, me] = await Promise.all([accounts(), tenants(), operatorOrNull()]);
  return (
    <Accounts
      accounts={rows}
      tenants={spaces.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
      myUserId={me?.userId ?? ""}
    />
  );
}
