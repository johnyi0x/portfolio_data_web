import type { Metadata } from "next";
import type { BoardSnapshot, PairRow } from "@/lib/board";
import { HEATMAP_OG_HEIGHT, HEATMAP_OG_WIDTH } from "@/lib/heatmap-share-card";
import { DEFAULT_RANKER, rankerLabel, type Ranker } from "@/lib/ranker";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://bagrank.xyz";

export function cycleShareKey(cycleTs: string | null | undefined): string {
  if (!cycleTs) return "";
  return cycleTs
    .replace(/Z$/i, "")
    .replace(/[-:]/g, "")
    .replace(" ", "T")
    .replace(/\.\d+$/, "")
    .slice(0, 15);
}

function withRanker(path: string, ranker: Ranker): string {
  if (ranker === DEFAULT_RANKER) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}ranker=${encodeURIComponent(ranker)}`;
}

export function heatmapSharePath(
  cycleTs: string | null | undefined,
  ranker: Ranker = DEFAULT_RANKER,
): string {
  const t = cycleShareKey(cycleTs);
  const base = t ? `/share/heatmap?t=${encodeURIComponent(t)}` : "/share/heatmap";
  return withRanker(base, ranker);
}

export function heatmapShareUrl(
  cycleTs: string | null | undefined,
  ranker: Ranker = DEFAULT_RANKER,
): string {
  return `${SITE_URL}${heatmapSharePath(cycleTs, ranker)}`;
}

export function heatmapOgPath(
  cycleTs: string | null | undefined,
  ranker: Ranker = DEFAULT_RANKER,
): string {
  const t = cycleShareKey(cycleTs);
  const base = t ? `/og/heatmap?t=${encodeURIComponent(t)}` : "/og/heatmap";
  return withRanker(base, ranker);
}

export function heatmapTweetText(
  row: PairRow | undefined,
  listed: number,
  ranker: Ranker = DEFAULT_RANKER,
): string {
  const who = rankerLabel(ranker).toLowerCase();
  if (!row) {
    return `hyperliquid top ${listed} ${who} hold map on bagrank`;
  }
  const pct = Math.round(row.holdPct * 1000) / 10;
  const name = row.dex ? `${row.label} ${row.dex}` : row.label;
  return `${name} ${row.side} is dominating with ${pct}% on bagrank (${who}).\nare hyperliquid top ${listed} traders know something we dont?`;
}

export function xIntentUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${q.toString()}`;
}

export function heatmapCardMetadata(
  board: BoardSnapshot,
  opts: { url: string; title: string; noIndex?: boolean },
): Metadata {
  const ranker = board.ranker ?? DEFAULT_RANKER;
  const og = heatmapOgPath(board.cycleTs, ranker);
  const top = board.rows[0];
  const description = heatmapTweetText(top, board.listed, ranker).replace(/\n/g, " ");
  return {
    title: opts.title,
    description,
    robots: opts.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: "bagrank heatmap",
      description,
      url: opts.url,
      type: "website",
      images: [
        {
          url: og,
          width: HEATMAP_OG_WIDTH,
          height: HEATMAP_OG_HEIGHT,
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
