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
    <div className="flex h-full">
      <Sidebar workspace={workspace} user={user} {...shell} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
