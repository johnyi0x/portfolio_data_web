export type Side = "long" | "short";

export type PairRow = {
  rank: number;
  coin: string;
  label: string;
  dex: string;
  side: Side;
  wallets: number;
  onCoin: number;
  longN: number;
  shortN: number;
  holdPct: number;
  agreement: number;
  leverage: number;
};

export type BoardSnapshot = {
  configured: boolean;
  error: string | null;
  cycleTs: string | null;
  capturedAt: string | null;
  listed: number;
  snappedOk: number;
  status: string | null;
  coverage: number | null;
  rankWindow: string;
  rows: PairRow[];
};

export function splitCoin(coin: string): { label: string; dex: string } {
  if (coin.includes(":")) {
    const [dex, label] = coin.split(":", 2);
    return { dex, label };
  }
  return { dex: "", label: coin };
}

export function rankWindowLabel(window: string): string {
  const w = window.trim().toLowerCase();
  if (w === "week" || w.includes("week")) return "7-day ROI";
  if (w === "day" || w.includes("day")) return "1-day ROI";
  if (w === "month" || w.includes("month")) return "30-day ROI";
  return "7-day ROI";
}

export function formatUtcStamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}
