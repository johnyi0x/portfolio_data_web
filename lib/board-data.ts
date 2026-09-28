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
  prev_long_n: number | string | null;
  prev_short_n: number | string | null;
  prev_snapped_ok: number | string | null;
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

function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
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
    prevSnappedOk: null,
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
  const prevLongN = intOrNull(row.prev_long_n);
  const prevShortN = intOrNull(row.prev_short_n);
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
    prevLongN,
    prevShortN,
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
    prevSnappedOk: intOrNull(head.prev_snapped_ok),
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
        p.long_n AS prev_long_n,
        p.short_n AS prev_short_n,
        (SELECT snapped_ok FROM collector_runs
          WHERE venue = ${VENUE}
            AND cycle_ts = (SELECT cycle_ts FROM prev_cycle)
          LIMIT 1) AS prev_snapped_ok,
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
      p.long_n AS prev_long_n,
      p.short_n AS prev_short_n,
      (SELECT snapped_ok FROM collector_runs
        WHERE venue = ${VENUE}
          AND cycle_ts = (SELECT cycle_ts FROM prev_cycle)
        LIMIT 1) AS prev_snapped_ok,
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

function votes(n: number | null | undefined): number {
  return n == null || !Number.isFinite(n) ? 0 : Math.max(0, n);
}

function majorityOf(longN: number, shortN: number): { side: Side; wallets: number } {
  if (shortN > longN) return { side: "short", wallets: shortN };
  return { side: "long", wallets: Math.max(0, longN) };
}

function addPair(
  pnl: PairRow | undefined,
  roi: PairRow | undefined,
  denom: number,
  prevDenom: number,
): PairRow | null {
  const src = pnl ?? roi;
  if (!src) return null;
  const longN = votes(pnl?.longN) + votes(roi?.longN);
  const shortN = votes(pnl?.shortN) + votes(roi?.shortN);
  if (longN + shortN <= 0) return null;
  const { side, wallets } = majorityOf(longN, shortN);
  const onCoin = longN + shortN;
  const holdPct = denom > 0 ? wallets / denom : 0;
  const hadPrev =
    pnl?.prevLongN != null ||
    pnl?.prevShortN != null ||
    roi?.prevLongN != null ||
    roi?.prevShortN != null;
  const prevLong = votes(pnl?.prevLongN) + votes(roi?.prevLongN);
  const prevShort = votes(pnl?.prevShortN) + votes(roi?.prevShortN);
  const prevHoldPct =
    hadPrev && prevDenom > 0 ? majorityOf(prevLong, prevShort).wallets / prevDenom : null;
  const pnlW = votes(pnl?.onCoin);
  const roiW = votes(roi?.onCoin);
  const levW = pnlW + roiW;
  const leverage =
    levW > 0
      ? Math.max(
          1,
          Math.round(
            ((pnl?.leverage ?? 0) * pnlW + (roi?.leverage ?? 0) * roiW) / levW,
          ),
        )
      : src.leverage;
  const priced = pnlW >= roiW ? pnl : roi;
  return {
    rank: 0,
    coin: src.coin,
    label: src.label,
    dex: src.dex,
    side,
    wallets,
    onCoin,
    longN,
    shortN,
    holdPct,
    agreement: onCoin > 0 ? wallets / onCoin : 0,
    leverage,
    rankDelta: null,
    prevHoldPct,
    prevLongN: hadPrev ? prevLong : null,
    prevShortN: hadPrev ? prevShort : null,
    holdDelta: prevHoldPct == null ? null : holdPct - prevHoldPct,
    price: priced?.price ?? src.price,
    changePct: priced?.changePct ?? src.changePct,
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

  const denom = Math.max(0, pnl.snappedOk) + Math.max(0, roi.snappedOk);
  const prevDenom = (pnl.prevSnappedOk ?? 0) + (roi.prevSnappedOk ?? 0);
  const pnlBy = new Map(pnl.rows.map((row) => [row.coin, row]));
  const roiBy = new Map(roi.rows.map((row) => [row.coin, row]));
  const merged: PairRow[] = [];
  for (const coin of new Set([...pnlBy.keys(), ...roiBy.keys()])) {
    const row = addPair(pnlBy.get(coin), roiBy.get(coin), denom, prevDenom);
    if (row) merged.push(row);
  }
  merged.sort(
    (a, b) => b.wallets - a.wallets || b.holdPct - a.holdPct || a.coin.localeCompare(b.coin),
  );
  const prevOrder = [...merged]
    .filter((row) => row.prevHoldPct != null)
    .sort(
      (a, b) =>
        (b.prevHoldPct ?? 0) - (a.prevHoldPct ?? 0) || a.coin.localeCompare(b.coin),
    );
  const prevRank = new Map(prevOrder.map((row, i) => [row.coin, i + 1]));
  merged.forEach((row, i) => {
    row.rank = i + 1;
    const prev = prevRank.get(row.coin);
    row.rankDelta = prev == null ? null : prev - row.rank;
  });

  const listed = Math.max(1, pnl.listed) + Math.max(1, roi.listed);
  const capturedAt = [pnl.capturedAt, roi.capturedAt]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const coverage =
    pnl.coverage != null && roi.coverage != null && denom > 0
      ? (pnl.coverage * pnl.snappedOk + roi.coverage * roi.snappedOk) / denom
      : (pnl.coverage ?? roi.coverage);

  return {
    configured: true,
    error: merged.length ? null : "No pairs on the PnL or ROI board this hour",
    cycleTs: pnl.cycleTs || roi.cycleTs,
    capturedAt,
    listed,
    snappedOk: denom,
    prevSnappedOk: prevDenom > 0 ? prevDenom : null,
    status: pnl.status === "ok" && roi.status === "ok" ? "ok" : pnl.status || roi.status,
    coverage,
    rankWindow: rankWindowLabel(RANK_WINDOW, "PnL + ROI"),
    ranker: "both",
    rows: merged,
  };
}

type CoinHistRow = {
  cycle_ts: Date | string;
  snapped_ok: number | string | null;
  coin: string | null;
  long_n: number | string | null;
  short_n: number | string | null;
};

type HourBucket = {
  ts: number;
  stamp: string;
  snappedOk: number;
  coins: Map<string, { longN: number; shortN: number }>;
};

function hourBucket(ts: number): number {
  return Math.floor(ts / 3_600_000) * 3_600_000;
}

function indexCoinHistory(rows: CoinHistRow[]): Map<number, HourBucket> {
  const byHour = new Map<number, HourBucket>();
  for (const row of rows) {
    const stamp = formatUtcStamp(row.cycle_ts);
    if (!stamp) continue;
    const ts = new Date(row.cycle_ts).getTime();
    if (!Number.isFinite(ts)) continue;
    const bucket = hourBucket(ts);
    let hour = byHour.get(bucket);
    if (!hour || ts > hour.ts) {
      hour = {
        ts,
        stamp,
        snappedOk: Math.max(0, Math.round(num(row.snapped_ok))),
        coins: new Map(),
      };
      byHour.set(bucket, hour);
    } else if (ts === hour.ts) {
      hour.snappedOk = Math.max(hour.snappedOk, Math.round(num(row.snapped_ok)));
    }
    const coin = String(row.coin || "");
    if (!coin || ts !== hour.ts) continue;
    hour.coins.set(coin, {
      longN: Math.max(0, Math.round(num(row.long_n))),
      shortN: Math.max(0, Math.round(num(row.short_n))),
    });
  }
  return byHour;
}

async function queryCoinHistory(
  sql: SqlClient,
  coins: string[],
): Promise<CoinHistRow[]> {
  if (!coins.length) return [];
  return (await sql`
    WITH hours AS (
      SELECT cycle_ts, snapped_ok
      FROM collector_runs
      WHERE venue = ${VENUE}
        AND status IN ('ok', 'partial')
      ORDER BY cycle_ts DESC
      LIMIT 24
    )
    SELECT
      h.cycle_ts,
      h.snapped_ok,
      m.coin,
      m.long_n,
      m.short_n
    FROM hours h
    LEFT JOIN meta_index m
      ON m.cycle_ts = h.cycle_ts
     AND m.venue = ${VENUE}
     AND m.coin = ANY(${coins})
    ORDER BY h.cycle_ts ASC
  `) as CoinHistRow[];
}

function buildAddedHistory(
  coins: string[],
  pnlRows: CoinHistRow[],
  roiRows: CoinHistRow[],
): RankHistory {
  const pnlHours = indexCoinHistory(pnlRows);
  const roiHours = indexCoinHistory(roiRows);
  const buckets = [...new Set([...pnlHours.keys(), ...roiHours.keys()])].sort(
    (a, b) => a - b,
  );
  const hours: RankHistory["hours"] = [];
  const pointsByCoin = new Map<string, RankHistoryPoint[]>(
    coins.map((coin) => [coin, []]),
  );

  for (const bucket of buckets) {
    const pnl = pnlHours.get(bucket);
    const roi = roiHours.get(bucket);
    const denom = (pnl?.snappedOk ?? 0) + (roi?.snappedOk ?? 0);
    if (denom <= 0) continue;
    const ts = Math.max(pnl?.ts ?? 0, roi?.ts ?? 0);
    const stamp = (pnl && roi ? (pnl.ts >= roi.ts ? pnl : roi) : (pnl ?? roi))
      ?.stamp;
    if (!stamp) continue;

    const hourPoints: { coin: string; point: RankHistoryPoint }[] = [];
    for (const coin of coins) {
      const a = pnl?.coins.get(coin);
      const b = roi?.coins.get(coin);
      const longN = (a?.longN ?? 0) + (b?.longN ?? 0);
      const shortN = (a?.shortN ?? 0) + (b?.shortN ?? 0);
      if (longN + shortN <= 0) continue;
      const { side, wallets } = majorityOf(longN, shortN);
      hourPoints.push({
        coin,
        point: {
          ts,
          stamp,
          rank: 0,
          side,
          holdPct: wallets / denom,
          wallets,
        },
      });
    }
    if (!hourPoints.length) continue;
    hours.push({ ts, stamp });
    hourPoints.sort((x, y) => y.point.wallets - x.point.wallets);
    hourPoints.forEach((row, i) => {
      row.point.rank = i + 1;
      pointsByCoin.get(row.coin)?.push(row.point);
    });
  }

  const series: RankHistorySeries[] = [];
  coins.forEach((coin, i) => {
    const points = pointsByCoin.get(coin) ?? [];
    if (!points.length) return;
    const { label, dex } = splitCoin(coin);
    series.push({
      coin,
      label,
      dex,
      latestRank: i + 1,
      points,
    });
  });
  return { hours, series };
}

async function loadCombinedRankHistory(coins: string[]): Promise<RankHistory> {
  const pnlSql = getSql("pnl");
  const roiSql = getSql("roi");
  if (!pnlSql || !roiSql || !coins.length) return { hours: [], series: [] };
  try {
    const [pnlRows, roiRows] = await Promise.all([
      queryCoinHistory(pnlSql, coins),
      queryCoinHistory(roiSql, coins),
    ]);
    return buildAddedHistory(coins, pnlRows, roiRows);
  } catch {
    return { hours: [], series: [] };
  }
}

function getCombinedRankHistory(coins: string[]): Promise<RankHistory> {
  const key = coins.join("|");
  return unstable_cache(
    () => loadCombinedRankHistory(coins),
    ["rank-history", VENUE, "both", key],
    { revalidate: 60, tags: ["board", "board-pnl", "board-roi"] },
  )();
}

/** Latest board for any tab. Combined view adds cached PnL + ROI — no extra SQL. */
export async function getBoard(ranker: Ranker): Promise<BoardSnapshot> {
  if (ranker !== "both") return getLatestBoard(ranker);
  const [pnl, roi] = await Promise.all([getLatestBoard("pnl"), getLatestBoard("roi")]);
  return combineBoards(pnl, roi);
}

/** 24h hold series. Combined top 5 loads those coins from both Neons (5×24 each). */
export async function getHistory(ranker: Ranker): Promise<RankHistory> {
  if (ranker !== "both") return getRankHistory(ranker);
  const board = await getBoard("both");
  const coins = board.rows.slice(0, RANK_CAP).map((row) => row.coin);
  return getCombinedRankHistory(coins);
}

