import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data";
import { connectionSettings } from "@/lib/mcp/actions";
import { Connections } from "@/components/settings/Connections";

/**
 * Who may ask this workspace anything.
 *
 * The endpoint's own address is read from the request rather than configured: a deployment behind a
 * proxy, on a preview URL or on localhost should print the address that actually works, and asking
 * an administrator to keep a base URL in sync with reality is a way of being wrong later.
 */
export default async function ConnectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const protocol = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const { tokens } = await connectionSettings(workspace.id);

  return (
    <Connections
      slug={slug}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      tokens={tokens}
      origin={`${protocol}://${host}`}
    />
  );
}
