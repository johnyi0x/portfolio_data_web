import type { Metadata } from "next";
import { BoardHome } from "@/components/BoardHome";
import { getLatestBoard } from "@/lib/board-data";
import { parseRanker } from "@/lib/ranker";
import { heatmapCardMetadata } from "@/lib/share";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ranker?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams;
  const ranker = parseRanker(q.ranker);
  const board = await getLatestBoard(ranker);
  return heatmapCardMetadata(board, {
    url: ranker === "pnl" ? "/" : `/?ranker=${ranker}`,
    title: "bagrank",
  });
}

export default async function HomePage({ searchParams }: Props) {
  const q = await searchParams;
  const ranker = parseRanker(q.ranker);
  return <BoardHome ranker={ranker} />;
}
