import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data";
import { operatorOrNull } from "@/lib/admin/guard";
import { SettingsNav } from "@/components/settings/SettingsNav";

/**
 * The settings area (§5.65).
 *
 * Four entries left the sidebar to live here, and the reason is frequency: what a model provider
 * is set to, who is in the workspace and what an MCP key can reach are things somebody changes
 * monthly, usually because something is wrong. Giving each of them a permanent slot beside the
 * boards charged the daily work for the monthly work.
 *
 * A shell rather than three unrelated pages: they were already at `/settings/*` and had nothing
 * in common but the address, so somebody who came to change a password and then wanted to check a
 * key had to go back out through the sidebar to find it.
 */
export default async function SettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, operator] = await Promise.all([getWorkspaceBySlug(slug), operatorOrNull()]);
  if (!workspace) notFound();
  return (
    <section className="settings-shell" aria-label="Settings">
      <SettingsNav slug={slug} isOperator={Boolean(operator)} workspaceName={workspace.name} />
      <div className="settings-body">{children}</div>
    </section>
  );
}
