import type { PairRow } from "@/lib/board";

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

export function heatmapSharePath(cycleTs: string | null | undefined): string {
  const t = cycleShareKey(cycleTs);
  return t ? `/share/heatmap?t=${encodeURIComponent(t)}` : "/share/heatmap";
}

export function heatmapShareUrl(cycleTs: string | null | undefined): string {
  return `${SITE_URL}${heatmapSharePath(cycleTs)}`;
}

export function heatmapOgPath(cycleTs: string | null | undefined): string {
  const t = cycleShareKey(cycleTs);
  return t ? `/og/heatmap?t=${encodeURIComponent(t)}` : "/og/heatmap";
}

export function heatmapTweetText(row: PairRow | undefined, listed: number): string {
  if (!row) {
    return `hyperliquid top ${listed} hold map on bagrank`;
  }
  const pct = Math.round(row.holdPct * 1000) / 10;
  const name = row.dex ? `${row.label} ${row.dex}` : row.label;
  return `${name} ${row.side} is dominating with ${pct}% on bagrank.\nare hyperliquid top ${listed} traders know something we dont?`;
}

export function xIntentUrl(text: string, url: string): string {
  const q = new URLSearchParams({ text, url });
  return `https://x.com/intent/tweet?${q.toString()}`;
}
