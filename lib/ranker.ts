export type Ranker = "pnl" | "roi";

export const DEFAULT_RANKER: Ranker = "pnl";

export function parseRanker(raw: string | null | undefined): Ranker {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "roi" || v === "roi-ranker" || v === "return") return "roi";
  if (v === "pnl" || v === "pnl-ranker" || v === "profit") return "pnl";
  return DEFAULT_RANKER;
}

export function rankerLabel(ranker: Ranker): string {
  return ranker === "pnl" ? "PnL ranker" : "ROI ranker";
}

export function rankerMetric(ranker: Ranker): "PnL" | "ROI" {
  return ranker === "pnl" ? "PnL" : "ROI";
}

export function rankerQuery(ranker: Ranker): string {
  return ranker === DEFAULT_RANKER ? "" : ranker;
}
