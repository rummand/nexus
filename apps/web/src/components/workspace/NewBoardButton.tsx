"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { createBoard } from "@/lib/actions";
import { Button } from "@/components/ui";

export function NewBoardButton({ workspaceId, roomId, variant = "primary", label = "New board" }: { workspaceId: string; roomId: string; variant?: "primary" | "secondary"; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant={variant} disabled={pending} onClick={() => start(() => createBoard({ workspaceId, roomId }))}>
      <Plus size={15} /> {pending ? "Creating…" : label}
    </Button>
  );
}

/** Dashed tile that creates a board in place. */
export function NewBoardTile({ workspaceId, roomId }: { workspaceId: string; roomId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => createBoard({ workspaceId, roomId }))}
      className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 text-ink-500 transition-colors hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"><Plus size={18} /></span>
      <span className="text-sm font-medium">{pending ? "Creating…" : "New board"}</span>
    </button>
  );
}
