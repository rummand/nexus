"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { Space } from "@/db/schema";
import { createBoard } from "@/lib/actions";

export function SpaceListItem({ space, slug, workspaceId }: { space: Space; slug: string; workspaceId: string }) {
  const pathname = usePathname();
  const href = `/w/${slug}/spaces/${space.id}`;
  const active = pathname === href;
  const [pending, start] = useTransition();
  return (
    <div className={active ? "active" : ""}>
      <Link href={href} title={space.name}>
        <em>{space.emoji}</em>
        <span>{space.name}</span>
      </Link>
      <i>
        <button type="button" title="New board in this space" disabled={pending} onClick={() => start(() => createBoard({ workspaceId, spaceId: space.id }))}>
          <Plus size={16} />
        </button>
        <Link href={href} title="Open space"><Settings2 size={15} /></Link>
      </i>
    </div>
  );
}
