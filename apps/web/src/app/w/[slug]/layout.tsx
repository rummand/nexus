import { notFound } from "next/navigation";
import { Sidebar } from "@/components/workspace/Sidebar";
import { getWorkspaceBySlug, getWorkspaceShell, getWorkspacesFor } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { viewer } from "@/lib/auth/guard";

/**
 * The shell every workspace page sits in.
 *
 * It is also where membership is checked (§5.48). Until there was a second workspace, resolving one
 * by slug and showing it to anybody signed in was a curiosity; with two it is the hole. Somebody
 * who is not a member gets `notFound` rather than a refusal, because "this workspace exists and you
 * cannot see it" is itself something they should not learn from a URL.
 */
export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [v, shell, workspaces] = await Promise.all([
    viewer(workspace.id),
    getWorkspaceShell(workspace.id, user.id),
    getWorkspacesFor(user.id),
  ]);
  if (!v.role) notFound();
  return (
    <main className="studio-home-shell">
      <Sidebar workspace={workspace} user={user} workspaces={workspaces} {...shell} />
      {children}
    </main>
  );
}
