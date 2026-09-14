import { ImageResponse } from "next/og";
import { getLatestBoard } from "@/lib/board-data";
import { HEATMAP_OG_SIZE, HeatmapShareCard } from "@/lib/heatmap-share-card";

export const runtime = "nodejs";
export const revalidate = 3600;
export const contentType = "image/png";
export const size = { width: HEATMAP_OG_SIZE, height: HEATMAP_OG_SIZE };

export async function GET() {
  const board = await getLatestBoard();
  const image = new ImageResponse(<HeatmapShareCard board={board} />, {
    width: HEATMAP_OG_SIZE,
    height: HEATMAP_OG_SIZE,
  });
  image.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
  return image;
}
