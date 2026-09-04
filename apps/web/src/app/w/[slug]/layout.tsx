import { notFound } from "next/navigation";
import { Sidebar } from "@/components/workspace/Sidebar";
import { getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const shell = await getWorkspaceShell(workspace.id, user.id);
  return (
    <main className="studio-home-shell">
      <Sidebar workspace={workspace} user={user} {...shell} />
      {children}
    </main>
  );
}
