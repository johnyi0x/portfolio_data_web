import { unstable_cache } from "next/cache";
import {
  formatUtcStamp,
  rankWindowLabel,
  splitCoin,
  type BoardSnapshot,
  type PairRow,
  type Side,
} from "@/lib/board";
import { getSql, missingDbMessage } from "@/lib/db";
import { rankerMetric, type NeonRanker, type Ranker } from "@/lib/ranker";

const VENUE = "hyperliquid";
const RANK_WINDOW = process.env.RANK_WINDOW?.trim() || "week";

type SqlClient = NonNullable<ReturnType<typeof getSql>>;

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
  prev_hold_pct: number | string | null;
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

function holdOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

function emptyBoard(
  ranker: Ranker,
  partial: Partial<BoardSnapshot> = {},
): BoardSnapshot {
  return {
    configured: true,
    error: null,
    cycleTs: null,
    capturedAt: null,
    listed: 200,
    snappedOk: 0,
    status: null,
    coverage: null,
    rankWindow: rankWindowLabel(RANK_WINDOW, rankerMetric(ranker)),
    ranker,
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
  const holdPct = num(row.hold_pct);
  const prevHoldPct = holdOrNull(row.prev_hold_pct);
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
    holdPct,
    agreement: num(row.agreement),
    leverage: Math.max(1, Math.round(num(row.median_leverage, 1))),
    rankDelta:
      row.prev_rank == null || row.prev_rank === ""
        ? null
        : num(row.prev_rank) - num(row.rank),
    prevHoldPct,
    holdDelta: prevHoldPct == null ? null : holdPct - prevHoldPct,
    price,
    changePct: changePct(price, prevPrice, open),
  };
}

async function loadLatestBoard(ranker: NeonRanker): Promise<BoardSnapshot> {
  const sql = getSql(ranker);
  if (!sql) {
    return emptyBoard(ranker, {
      configured: false,
      error: missingDbMessage(ranker),
    });
  }

  try {
    const rows = await queryLatestBoard(sql, true);
    return boardFromRows(ranker, rows);
  } catch (err) {
    if (isMissingCoinPrices(err)) {
      try {
        const rows = await queryLatestBoard(sql, false);
        return boardFromRows(ranker, rows);
      } catch (retryErr) {
        return boardQueryError(ranker, retryErr);
      }
    }
    return boardQueryError(ranker, err);
  }
}

function boardFromRows(ranker: NeonRanker, rows: RunRow[]): BoardSnapshot {
  if (!rows.length) {
    return emptyBoard(ranker, {
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
    rankWindow: rankWindowLabel(RANK_WINDOW, rankerMetric(ranker)),
    ranker,
    rows: pairRows,
  };
}

function isMissingCoinPrices(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /coin_prices/i.test(message) && /does not exist/i.test(message);
}

function boardQueryError(ranker: NeonRanker, err: unknown): BoardSnapshot {
  const message = err instanceof Error ? err.message : "Neon query failed";
  const missing =
    /relation .* does not exist/i.test(message) ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "42P01");
  return emptyBoard(ranker, {
    error: missing
      ? "Collector tables not found on this Neon database"
      : message,
  });
}

async function queryLatestBoard(
  sql: SqlClient,
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
        p.hold_pct AS prev_hold_pct,
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
      p.hold_pct AS prev_hold_pct,
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

export async function getLatestBoard(ranker: NeonRanker): Promise<BoardSnapshot> {
  return unstable_cache(
    () => loadLatestBoard(ranker),
    ["board", VENUE, ranker],
    { revalidate: 60, tags: ["board", `board-${ranker}`] },
  )();
}

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

async function loadRankHistory(ranker: NeonRanker): Promise<RankHistory> {
  const sql = getSql(ranker);
  if (!sql) return { hours: [], series: [] };
  try {
    // Up to last 24 ok/partial hours; fewer available hours still chart.
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

export async function getRankHistory(ranker: NeonRanker): Promise<RankHistory> {
  return unstable_cache(
    () => loadRankHistory(ranker),
    ["rank-history", VENUE, ranker],
    { revalidate: 60, tags: ["board", `board-${ranker}`] },
  )();
}

function geoMean(a: number, b: number): number {
  return Math.sqrt(Math.max(0, a) * Math.max(0, b));
}

function combinePair(pnl: PairRow, roi: PairRow): PairRow {
  const holdPct = geoMean(pnl.holdPct, roi.holdPct);
  const prevP = pnl.prevHoldPct;
  const prevR = roi.prevHoldPct;
  const prevHoldPct =
    prevP != null && prevR != null ? geoMean(prevP, prevR) : null;
  return {
    rank: 0,
    coin: pnl.coin,
    label: pnl.label,
    dex: pnl.dex,
    side: pnl.side,
    wallets: Math.round((pnl.wallets + roi.wallets) / 2),
    onCoin: Math.round((pnl.onCoin + roi.onCoin) / 2),
    longN: Math.round((pnl.longN + roi.longN) / 2),
    shortN: Math.round((pnl.shortN + roi.shortN) / 2),
    holdPct,
    agreement: Math.min(pnl.agreement, roi.agreement),
    leverage: Math.max(1, Math.round((pnl.leverage + roi.leverage) / 2)),
    rankDelta: null,
    prevHoldPct,
    holdDelta: prevHoldPct == null ? null : holdPct - prevHoldPct,
    price: pnl.price ?? roi.price,
    changePct: pnl.changePct ?? roi.changePct,
  };
}

function combineBoards(pnl: BoardSnapshot, roi: BoardSnapshot): BoardSnapshot {
  if (!pnl.configured) {
    return emptyBoard("both", { configured: false, error: pnl.error });
  }
  if (!roi.configured) {
    return emptyBoard("both", { configured: false, error: roi.error });
  }
  if (pnl.error && !pnl.rows.length) {
    return emptyBoard("both", { error: `PnL: ${pnl.error}` });
  }
  if (roi.error && !roi.rows.length) {
    return emptyBoard("both", { error: `ROI: ${roi.error}` });
  }

  const roiByCoin = new Map(roi.rows.map((row) => [row.coin, row]));
  const merged: PairRow[] = [];
  for (const p of pnl.rows) {
    const r = roiByCoin.get(p.coin);
    if (!r || r.side !== p.side) continue;
    merged.push(combinePair(p, r));
  }
  merged.sort((a, b) => b.holdPct - a.holdPct || b.wallets - a.wallets);
  merged.forEach((row, i) => {
    row.rank = i + 1;
  });

  const listed = Math.max(pnl.listed, roi.listed, 200);
  const snappedOk = Math.min(pnl.snappedOk || listed, roi.snappedOk || listed);
  const capturedAt = [pnl.capturedAt, roi.capturedAt]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    configured: true,
    error: merged.length ? null : "No same-side overlap between PnL and ROI boards this hour",
    cycleTs: pnl.cycleTs || roi.cycleTs,
    capturedAt,
    listed,
    snappedOk,
    status: pnl.status === "ok" && roi.status === "ok" ? "ok" : pnl.status || roi.status,
    coverage:
      pnl.coverage != null && roi.coverage != null
        ? Math.min(pnl.coverage, roi.coverage)
        : (pnl.coverage ?? roi.coverage),
    rankWindow: rankWindowLabel(RANK_WINDOW, "PnL + ROI"),
    ranker: "both",
    rows: merged,
  };
}

function combineHistories(
  pnl: RankHistory,
  roi: RankHistory,
  overlapCoins: Set<string>,
): RankHistory {
  const roiByCoin = new Map(roi.series.map((s) => [s.coin, s]));
  const hourMap = new Map<number, { ts: number; stamp: string }>();
  for (const h of pnl.hours) hourMap.set(h.ts, h);
  for (const h of roi.hours) {
    if (hourMap.has(h.ts)) hourMap.set(h.ts, h);
  }
  // Only hours both collectors stored (same cycle_ts bucket).
  const bothHours = new Set(pnl.hours.map((h) => h.ts));
  const hours = [...hourMap.values()]
    .filter((h) => bothHours.has(h.ts) && roi.hours.some((x) => x.ts === h.ts))
    .sort((a, b) => a.ts - b.ts);

  const series: RankHistorySeries[] = [];
  for (const pSeries of pnl.series) {
    if (!overlapCoins.has(pSeries.coin)) continue;
    const rSeries = roiByCoin.get(pSeries.coin);
    if (!rSeries) continue;
    const rByTs = new Map(rSeries.points.map((pt) => [pt.ts, pt]));
    const points: RankHistoryPoint[] = [];
    for (const h of hours) {
      const a = pSeries.points.find((pt) => pt.ts === h.ts);
      const b = rByTs.get(h.ts);
      if (!a || !b || a.side !== b.side) continue;
      points.push({
        ts: h.ts,
        stamp: h.stamp,
        rank: Math.min(a.rank, b.rank),
        side: a.side,
        holdPct: geoMean(a.holdPct, b.holdPct),
        wallets: Math.round((a.wallets + b.wallets) / 2),
      });
    }
    if (points.length < 1) continue;
    series.push({
      coin: pSeries.coin,
      label: pSeries.label,
      dex: pSeries.dex,
      latestRank: points[points.length - 1].rank,
      points,
    });
  }
  series.sort((a, b) => {
    const ah = a.points[a.points.length - 1]?.holdPct ?? 0;
    const bh = b.points[b.points.length - 1]?.holdPct ?? 0;
    return bh - ah;
  });
  return { hours, series: series.slice(0, RANK_CAP) };
}

/** Latest board for any tab. Combined view joins cached PnL + ROI — no extra SQL. */
export async function getBoard(ranker: Ranker): Promise<BoardSnapshot> {
  if (ranker !== "both") return getLatestBoard(ranker);
  const [pnl, roi] = await Promise.all([getLatestBoard("pnl"), getLatestBoard("roi")]);
  return combineBoards(pnl, roi);
}

/** 24h hold series. Combined view joins cached histories in memory. */
export async function getHistory(ranker: Ranker): Promise<RankHistory> {
  if (ranker !== "both") return getRankHistory(ranker);
  const [pnlBoard, roiBoard, pnlH, roiH] = await Promise.all([
    getLatestBoard("pnl"),
    getLatestBoard("roi"),
    getRankHistory("pnl"),
    getRankHistory("roi"),
  ]);
  const overlap = new Set<string>();
  const roiCoins = new Map(roiBoard.rows.map((r) => [r.coin, r]));
  for (const p of pnlBoard.rows) {
    const r = roiCoins.get(p.coin);
    if (r && r.side === p.side) overlap.add(p.coin);
  }
  return combineHistories(pnlH, roiH, overlap);
}

