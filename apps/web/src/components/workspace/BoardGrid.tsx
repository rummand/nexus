import type { BoardCard as BoardCardData } from "@/lib/data";
import { BoardCard } from "./BoardCard";
import { NewBoardTile } from "./NewBoardButton";

export function BoardGrid({ boards, showRoom = true, newBoard }: { boards: BoardCardData[]; showRoom?: boolean; newBoard?: { workspaceId: string; roomId: string } }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {newBoard && <NewBoardTile {...newBoard} />}
      {boards.map((b) => (
        <BoardCard key={b.id} board={b} showRoom={showRoom} />
      ))}
    </div>
  );
}
