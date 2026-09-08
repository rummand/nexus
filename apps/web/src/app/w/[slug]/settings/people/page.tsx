import { notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMembers } from "@/lib/data";
import { viewer } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";
import { isRole, type Role } from "@/lib/auth/roles";
import { People } from "@/components/settings/People";

/**
 * Who is in this workspace, and what they may do (§5.46).
 *
 * The page renders for anybody — knowing who your colleagues are is not privileged — and the
 * controls only appear for somebody who may use them. The actions check again on the server, so
 * hiding a button is a courtesy rather than the enforcement.
 */
export default async function PeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, me] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [rows, v] = await Promise.all([getWorkspaceMembers(workspace.id), viewer(workspace.id)]);

  const people = rows
    .map((r) => ({
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      color: r.user.color,
      role: (isRole(r.role) ? r.role : "member") as Role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <People slug={slug} workspaceId={workspace.id} people={people} myUserId={me.id} myRole={v.role} canManage={v.can("people.manage")} />;
}
