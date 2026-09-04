import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { NewTeamDialog } from "@/components/workspace/NewTeamDialog";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Avatar, Button } from "@/components/ui";
import { getTeamsWithMembers, getWorkspaceBySlug } from "@/lib/data";

export default async function TeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const teams = await getTeamsWithMembers(workspace.id);
  return (
    <>
      <PageHeader title="Teams" subtitle="Groups of people who share rooms and boards" actions={<NewTeamDialog workspaceId={workspace.id} trigger={<Button variant="primary"><Plus size={15} /> New team</Button>} />} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {teams.map((t) => (
          <Link key={t.id} href={`/w/${slug}/teams/${t.id}`} className="group rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-float">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: t.color }} />
              <span className="text-sm font-semibold group-hover:text-accent-700">{t.name}</span>
            </div>
            {t.description && <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{t.description}</p>}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {t.members.slice(0, 5).map((m) => <Avatar key={m.userId} name={m.user.name} color={m.user.color} size={24} />)}
              </div>
              <span className="text-[11px] text-ink-500">{t.members.length} members · {t.rooms.length} rooms</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
