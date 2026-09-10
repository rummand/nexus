import { redirect } from "next/navigation";
import { SETTINGS } from "@/components/workspace/nav";

/**
 * `/settings` is the address in the sidebar, so it has to lead somewhere (§5.65).
 *
 * It redirects to the first entry rather than rendering a menu of the three links already visible
 * in the nav beside it. A landing page whose only content is the navigation next to it is a click
 * charged for nothing.
 */
export default async function SettingsIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/w/${slug}${SETTINGS[0]!.path}`);
}
