import type { Metadata } from "next";
import { BoardHome } from "@/components/BoardHome";
import { getLatestBoard } from "@/lib/board-data";
import { heatmapCardMetadata } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const board = await getLatestBoard();
  return heatmapCardMetadata(board, {
    url: "/",
    title: "bagrank",
  });
}

export default function HomePage() {
  return <BoardHome />;
}
