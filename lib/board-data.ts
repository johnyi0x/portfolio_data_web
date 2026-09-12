import { unstable_cache } from "next/cache";
import {
  formatUtcStamp,
  rankWindowLabel,
  splitCoin,
  type BoardSnapshot,
  type PairRow,
  type Side,
} from "@/lib/board";
import { getSql } from "@/lib/db";

const VENUE = "hyperliquid";
const RANK_WINDOW = process.env.RANK_WINDOW?.trim() || "week";

type RunRow = {
  cycle_ts: Date | string;
  listed: number | string | null;
  snapped_ok: number | string | null;
  status: string | null;
  finished_at: Date | string | null;
  coverage: number | string | null;
  coin: string | null;
  side: string | null;
  wallets: number | string | null;
  hold_pct: number | string | null;
  agreement: number | string | null;
  long_n: number | string | null;
  short_n: number | string | null;
  median_leverage: number | string | null;
  rank: number | string | null;
  prev_rank: number | string | null;
};

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function emptyBoard(partial: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    configured: true,
    error: null,
    cycleTs: null,
    capturedAt: null,
    listed: 200,
    snappedOk: 0,
    status: null,
    coverage: null,
    rankWindow: rankWindowLabel(RANK_WINDOW),
    rows: [],
    ...partial,
  };
}

function toPairRow(row: RunRow): PairRow | null {
  if (!row.coin || !row.side) return null;
  const side = row.side === "short" ? "short" : "long";
  const longN = num(row.long_n);
  const shortN = num(row.short_n);
  const { label, dex } = splitCoin(row.coin);
  return {
    rank: num(row.rank),
    coin: row.coin,
    label,
    dex,
    side: side as Side,
    wallets: num(row.wallets),
    onCoin: longN + shortN,
    longN,
    shortN,
    holdPct: num(row.hold_pct),
    agreement: num(row.agreement),
    leverage: Math.max(1, Math.round(num(row.median_leverage, 1))),
    rankDelta:
      row.prev_rank == null || row.prev_rank === ""
        ? null
        : num(row.prev_rank) - num(row.rank),
  };
}

async function loadLatestBoard(): Promise<BoardSnapshot> {
  const sql = getSql();
  if (!sql) {
    return emptyBoard({
      configured: false,
      error: "Neon database URL is not set",
    });
  }

  try {
    const rows = (await sql`
      WITH latest AS (
        SELECT cycle_ts, listed, snapped_ok, status, finished_at, coverage
        FROM collector_runs
        WHERE venue = ${VENUE}
          AND status IN ('ok', 'partial')
        ORDER BY cycle_ts DESC
        LIMIT 1
      ),
      prev_cycle AS (
        SELECT cycle_ts
        FROM collector_runs
        WHERE venue = ${VENUE}
          AND status IN ('ok', 'partial')
          AND cycle_ts < (SELECT cycle_ts FROM latest)
        ORDER BY cycle_ts DESC
        LIMIT 1
      )
      SELECT
        l.cycle_ts,
        l.listed,
        l.snapped_ok,
        l.status,
        l.finished_at,
        l.coverage,
        m.coin,
        m.side,
        m.wallets,
        m.hold_pct,
        m.agreement,
        m.long_n,
        m.short_n,
        m.median_leverage,
        m.rank,
        p.rank AS prev_rank
      FROM latest l
      LEFT JOIN meta_index m
        ON m.cycle_ts = l.cycle_ts
       AND m.venue = ${VENUE}
      LEFT JOIN meta_index p
        ON p.cycle_ts = (SELECT cycle_ts FROM prev_cycle)
       AND p.venue = ${VENUE}
       AND p.coin = m.coin
      ORDER BY m.rank ASC NULLS LAST
    `) as RunRow[];

    if (!rows.length) {
      return emptyBoard({
        error: "No snapshot in Neon yet",
      });
    }

    const head = rows[0];
    const pairRows = rows
      .map(toPairRow)
      .filter((row): row is PairRow => row != null);

    return {
      configured: true,
      error: null,
      cycleTs: formatUtcStamp(head.cycle_ts),
      capturedAt: formatUtcStamp(head.finished_at) ?? formatUtcStamp(head.cycle_ts),
      listed: Math.max(1, Math.round(num(head.listed, 200))),
      snappedOk: Math.max(0, Math.round(num(head.snapped_ok))),
      status: head.status,
      coverage: head.coverage == null ? null : num(head.coverage),
      rankWindow: rankWindowLabel(RANK_WINDOW),
      rows: pairRows,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neon query failed";
    const missing =
      /relation .* does not exist/i.test(message) ||
      (typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "42P01");
    return emptyBoard({
      error: missing
        ? "Collector tables not found on this Neon database"
        : message,
    });
  }
}

export const getLatestBoard = unstable_cache(loadLatestBoard, ["board", VENUE], {
  revalidate: 60,
  tags: ["board"],
});
