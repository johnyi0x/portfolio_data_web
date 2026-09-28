export type NeonRanker = "pnl" | "roi";
export type Ranker = NeonRanker | "both";

export const DEFAULT_RANKER: Ranker = "pnl";

export function isNeonRanker(ranker: Ranker): ranker is NeonRanker {
  return ranker === "pnl" || ranker === "roi";
}

export function parseRanker(raw: string | null | undefined): Ranker {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "roi" || v === "roi-ranker" || v === "return") return "roi";
  if (v === "pnl" || v === "pnl-ranker" || v === "profit") return "pnl";
  if (
    v === "both" ||
    v === "pnl+roi" ||
    v === "pnl-roi" ||
    v === "combo" ||
    v === "overlap"
  ) {
    return "both";
  }
  return DEFAULT_RANKER;
}

export function rankerLabel(ranker: Ranker): string {
  if (ranker === "both") return "PnL + ROI ranker";
  return ranker === "pnl" ? "PnL ranker" : "ROI ranker";
}

export function rankerMetric(ranker: Ranker): "PnL" | "ROI" | "PnL + ROI" {
  if (ranker === "both") return "PnL + ROI";
  return ranker === "pnl" ? "PnL" : "ROI";
}

export function rankerQuery(ranker: Ranker): string {
  return ranker === DEFAULT_RANKER ? "" : ranker;
}
