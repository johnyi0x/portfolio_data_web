import { ImageResponse } from "next/og";
import { getLatestBoard } from "@/lib/board-data";
import {
  HEATMAP_OG_HEIGHT,
  HEATMAP_OG_WIDTH,
  HeatmapShareCard,
} from "@/lib/heatmap-share-card";
import { parseRanker } from "@/lib/ranker";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(req: Request) {
  const ranker = parseRanker(new URL(req.url).searchParams.get("ranker"));
  const board = await getLatestBoard(ranker);
  const image = new ImageResponse(<HeatmapShareCard board={board} />, {
    width: HEATMAP_OG_WIDTH,
    height: HEATMAP_OG_HEIGHT,
  });
  image.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
  return image;
}
