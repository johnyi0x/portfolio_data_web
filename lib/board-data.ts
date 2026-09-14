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
  mark_px: number | string | null;
  ohlc_close: number | string | null;
  ohlc_open: number | string | null;
  prev_mark_px: number | string | null;
  prev_ohlc_close: number | string | null;
};

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function changePct(price: number | null, prev: number | null, open: number | null): number | null {
  if (price == null) return null;
  if (prev != null && prev > 0) return (price - prev) / prev;
  if (open != null && open > 0) return (price - open) / open;
  return null;
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
  const price = numOrNull(row.mark_px) ?? numOrNull(row.ohlc_close);
  const prevPrice = numOrNull(row.prev_mark_px) ?? numOrNull(row.prev_ohlc_close);
  const open = numOrNull(row.ohlc_open);
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
    price,
    changePct: changePct(price, prevPrice, open),
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
    const rows = await queryLatestBoard(sql, true);
    return boardFromRows(rows);
  } catch (err) {
    if (isMissingCoinPrices(err)) {
      try {
        const rows = await queryLatestBoard(sql, false);
        return boardFromRows(rows);
      } catch (retryErr) {
        return boardQueryError(retryErr);
      }
    }
    return boardQueryError(err);
  }
}

function boardFromRows(rows: RunRow[]): BoardSnapshot {
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
}

function isMissingCoinPrices(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /coin_prices/i.test(message) && /does not exist/i.test(message);
}

function boardQueryError(err: unknown): BoardSnapshot {
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

async function queryLatestBoard(
  sql: NonNullable<ReturnType<typeof getSql>>,
  withPrices: boolean,
): Promise<RunRow[]> {
  if (withPrices) {
    return (await sql`
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
        p.rank AS prev_rank,
        cp.mark_px,
        cp.ohlc_close,
        cp.ohlc_open,
        cpp.mark_px AS prev_mark_px,
        cpp.ohlc_close AS prev_ohlc_close
      FROM latest l
      LEFT JOIN meta_index m
        ON m.cycle_ts = l.cycle_ts
       AND m.venue = ${VENUE}
      LEFT JOIN meta_index p
        ON p.cycle_ts = (SELECT cycle_ts FROM prev_cycle)
       AND p.venue = ${VENUE}
       AND p.coin = m.coin
      LEFT JOIN coin_prices cp
        ON cp.cycle_ts = l.cycle_ts
       AND cp.venue = ${VENUE}
       AND cp.coin = m.coin
      LEFT JOIN coin_prices cpp
        ON cpp.cycle_ts = (SELECT cycle_ts FROM prev_cycle)
       AND cpp.venue = ${VENUE}
       AND cpp.coin = m.coin
      ORDER BY m.rank ASC NULLS LAST
    `) as RunRow[];
  }

  return (await sql`
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
      p.rank AS prev_rank,
      NULL::numeric AS mark_px,
      NULL::numeric AS ohlc_close,
      NULL::numeric AS ohlc_open,
      NULL::numeric AS prev_mark_px,
      NULL::numeric AS prev_ohlc_close
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
}

export const getLatestBoard = unstable_cache(loadLatestBoard, ["board", VENUE], {
  revalidate: 60,
  tags: ["board"],
});

const RANK_CAP = 5;

export type RankHistoryPoint = {
  ts: number;
  stamp: string;
  rank: number;
  side: Side;
  holdPct: number;
  wallets: number;
};

export type RankHistorySeries = {
  coin: string;
  label: string;
  dex: string;
  latestRank: number;
  points: RankHistoryPoint[];
};

export type RankHistory = {
  hours: { ts: number; stamp: string }[];
  series: RankHistorySeries[];
};

type HistRow = {
  cycle_ts: Date | string;
  coin: string;
  side: string;
  rank: number | string;
  hold_pct: number | string;
  wallets: number | string;
};

async function loadRankHistory(): Promise<RankHistory> {
  const sql = getSql();
  if (!sql) return { hours: [], series: [] };
  try {
    const rows = (await sql`
      WITH hours AS (
        SELECT cycle_ts
        FROM collector_runs
        WHERE venue = ${VENUE}
          AND status IN ('ok', 'partial')
        ORDER BY cycle_ts DESC
        LIMIT 24
      ),
      latest AS (
        SELECT MAX(cycle_ts) AS cycle_ts FROM hours
      ),
      top AS (
        SELECT coin
        FROM meta_index
        WHERE venue = ${VENUE}
          AND cycle_ts = (SELECT cycle_ts FROM latest)
          AND rank <= 5
      )
      SELECT
        m.cycle_ts,
        m.coin,
        m.side,
        m.rank,
        m.hold_pct,
        m.wallets
      FROM meta_index m
      INNER JOIN hours h ON h.cycle_ts = m.cycle_ts
      INNER JOIN top t ON t.coin = m.coin
      WHERE m.venue = ${VENUE}
      ORDER BY m.cycle_ts ASC, m.rank ASC
    `) as HistRow[];

    const hourMap = new Map<number, { ts: number; stamp: string }>();
    const byCoin = new Map<string, RankHistoryPoint[]>();
    for (const row of rows) {
      const stamp = formatUtcStamp(row.cycle_ts);
      if (!stamp) continue;
      const ts = new Date(row.cycle_ts).getTime();
      if (!Number.isFinite(ts)) continue;
      hourMap.set(ts, { ts, stamp });
      const coin = String(row.coin || "");
      if (!coin) continue;
      const list = byCoin.get(coin) || [];
      list.push({
        ts,
        stamp,
        rank: Math.max(1, Math.round(num(row.rank, 99))),
        side: row.side === "short" ? "short" : "long",
        holdPct: num(row.hold_pct),
        wallets: Math.round(num(row.wallets)),
      });
      byCoin.set(coin, list);
    }

    const hours = [...hourMap.values()].sort((a, b) => a.ts - b.ts);
    const lastTs = hours.length ? hours[hours.length - 1].ts : 0;
    const series: RankHistorySeries[] = [];
    for (const [coin, points] of byCoin) {
      const ordered = [...points].sort((a, b) => a.ts - b.ts);
      let last = ordered[ordered.length - 1];
      for (let i = ordered.length - 1; i >= 0; i--) {
        if (ordered[i].ts === lastTs) {
          last = ordered[i];
          break;
        }
      }
      if (!last || last.rank > RANK_CAP) continue;
      const { label, dex } = splitCoin(coin);
      series.push({
        coin,
        label,
        dex,
        latestRank: last.rank,
        points: ordered,
      });
    }
    series.sort((a, b) => {
      const ah = a.points[a.points.length - 1]?.holdPct ?? 0;
      const bh = b.points[b.points.length - 1]?.holdPct ?? 0;
      return bh - ah;
    });
    return { hours, series };
  } catch {
    return { hours: [], series: [] };
  }
}

export const getRankHistory = unstable_cache(loadRankHistory, ["rank-history", VENUE], {
  revalidate: 60,
  tags: ["board"],
});
