import type { Metadata } from "next";
import { BoardHome } from "@/components/BoardHome";
import { getLatestBoard } from "@/lib/board-data";
import { parseRanker } from "@/lib/ranker";
import { heatmapCardMetadata, heatmapSharePath } from "@/lib/share";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ t?: string; ranker?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams;
  const ranker = parseRanker(q.ranker);
  const board = await getLatestBoard(ranker);
  const top = board.rows[0];
  const title = top
    ? `${top.label} ${top.side} ${Math.round(top.holdPct * 1000) / 10}% · heatmap`
    : "heatmap";
  return heatmapCardMetadata(board, {
    url: heatmapSharePath(q.t?.trim() || board.cycleTs, ranker),
    title,
    noIndex: true,
  });
}

export default async function HeatmapSharePage({ searchParams }: Props) {
  const q = await searchParams;
  const ranker = parseRanker(q.ranker);
  return <BoardHome ranker={ranker} />;
}
