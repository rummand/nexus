"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { Space } from "@/db/schema";
import { createBoard } from "@/lib/actions";

export function SpaceListItem({ space, slug, workspaceId }: { space: Space; slug: string; workspaceId: string }) {
  const pathname = usePathname();
  const href = `/w/${slug}/spaces/${space.id}`;
  const active = pathname === href;
  const [pending, start] = useTransition();
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <div className={active ? "active" : ""}>
      <Link href={href} title={space.name}>
        <em>{space.emoji}</em>
        <span>{space.name}</span>
      </Link>
      <i>
        <button
          type="button"
          title={refused ?? "New board in this space"}
          className={refused ? "refused" : undefined}
          disabled={pending}
          onClick={() => start(async () => {
            const r = await createBoard({ workspaceId, spaceId: space.id });
            // No room for a sentence beside a single icon, so the refusal becomes its tooltip.
            setRefused(r && "error" in r ? r.error : null);
          })}
        >
          <Plus size={16} />
        </button>
        <Link href={href} title="Open space"><Settings2 size={15} /></Link>
      </i>
    </div>
  );
}
