import type { Metadata } from "next";
import { BoardHome } from "@/components/BoardHome";
import { getLatestBoard } from "@/lib/board-data";
import {
  cycleShareKey,
  heatmapOgPath,
  heatmapSharePath,
  heatmapTweetText,
} from "@/lib/share";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams;
  const board = await getLatestBoard();
  const t = q.t?.trim() || cycleShareKey(board.cycleTs);
  const og = heatmapOgPath(t);
  const share = heatmapSharePath(t);
  const top = board.rows[0];
  const title = top
    ? `${top.label} ${top.side} ${Math.round(top.holdPct * 1000) / 10}% · heatmap`
    : "heatmap";
  const description = heatmapTweetText(top, board.listed).replace(/\n/g, " ");
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: {
      title: "bagrank heatmap",
      description,
      url: share,
      type: "website",
      images: [
        {
          url: og,
          width: 1200,
          height: 1200,
          type: "image/png",
          alt: "Hyperliquid bagrank heatmap",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "bagrank heatmap",
      description,
      images: [og],
    },
  };
}

export default function HeatmapSharePage() {
  return <BoardHome />;
}
