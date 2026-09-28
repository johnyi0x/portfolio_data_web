import { Suspense } from "react";
import { CrowdMovers } from "@/components/CrowdMovers";
import { Heatmap } from "@/components/Heatmap";
import { Leaderboard } from "@/components/Leaderboard";
import { RankChart } from "@/components/RankChart";
import { RankerSwitch } from "@/components/RankerSwitch";
import { RefreshMark } from "@/components/RefreshMark";
import { ShareOnX } from "@/components/ShareOnX";
import { getBoard, getHistory } from "@/lib/board-data";
import { rankerLabel, type Ranker } from "@/lib/ranker";
import { heatmapShareUrl, heatmapTweetText } from "@/lib/share";

export async function BoardHome({ ranker }: { ranker: Ranker }) {
  const [board, rankHistory] = await Promise.all([
    getBoard(ranker),
    getHistory(ranker),
  ]);
  const longs = board.rows.filter((r) => r.side === "long").length;
  const shorts = board.rows.length - longs;
  const n = board.listed;
  const top = board.rows[0];
  const hours = rankHistory.hours.length;
  const chartHint =
    hours > 0 && hours < 24
      ? ` · ${hours}h available`
      : hours >= 24
        ? " · last 24h"
        : "";

  return (
    <main className="page">
      <section className="intro">
        <div className="intro-tools">
          <Suspense fallback={null}>
            <RankerSwitch value={ranker} />
          </Suspense>
        </div>
        <h1 className="intro-title">
          {ranker === "both"
            ? `Same-side overlap of top ${n} PnL and top ${n} ROI wallets.`
            : `Top ${n} Hyperliquid wallets by ${board.rankWindow} BagRank Heatmap.`}
        </h1>
        <p className="intro-copy">
          {ranker === "both" ? (
            <>
              This tab does not snapshot a third wallet list. It joins this
              hour’s PnL board and ROI board in memory: a pair only appears
              if both crowds hold it on the same side. Tile size is combined
              hold (geometric mean of the two hold %). Green is long, red is
              short. Native and HIP-3 builder perps count the same.
            </>
          ) : (
            <>
              Each of the {n} wallets gets one vote per pair they hold. The
              tile is how many of those wallets are in that pair (majority
              side). Biggest tile = most of the top {n} are in it. Crowd hold
              map, not average rank inside each book. Green is long, red is
              short. Native and HIP-3 builder perps (xyz, io, and others)
              count the same; the badge is the dex. Board below uses the{" "}
              {rankerLabel(ranker).toLowerCase()} cohort (
              {ranker === "pnl"
                ? "Hyperliquid default sort"
                : "return % sort"}
              ).
            </>
          )}
        </p>
        <div className="meta">
          <span>{rankerLabel(ranker)}</span>
          <span>
            {ranker === "both"
              ? `overlap · ${board.rankWindow}`
              : `top ${n} · ${board.rankWindow}`}
          </span>
          {board.capturedAt ? <span>{board.capturedAt} UTC</span> : null}
          {board.rows.length ? (
            <span>
              {board.rows.length} pairs · {longs} long · {shorts} short
            </span>
          ) : null}
          {board.snappedOk > 0 ? (
            <span>
              {board.snappedOk}/{n} wallets snapped
              {board.status === "partial" ? " · partial" : ""}
            </span>
          ) : null}
          {board.error ? <span>{board.error}</span> : null}
        </div>
      </section>

      <section className="glass panel" id="heatmap">
        <div className="panel-head">
          <h2>
            {ranker === "both"
              ? `hyperliquid overlap heatmap`
              : `hyperliquid ${n} bagrank heatmap`}
          </h2>
          <div className="panel-head-tools">
            <ShareOnX
              label="Share heatmap"
              text={heatmapTweetText(top, n, ranker)}
              url={heatmapShareUrl(board.cycleTs, ranker)}
            />
            <RefreshMark capturedAt={board.capturedAt} />
          </div>
        </div>
        {board.rows.length ? (
          <Heatmap rows={board.rows} />
        ) : (
          <div className="heatmap empty-panel">
            <p>
              {board.error ?? "Waiting for the first Neon snapshot."}
            </p>
          </div>
        )}
      </section>

      <section className="glass panel" id="ranks">
        <div className="panel-head">
          <h2>
            {ranker === "both"
              ? `hyperliquid overlap chart${chartHint}`
              : `hyperliquid ${n} bagrank chart${chartHint}`}
          </h2>
        </div>
        {rankHistory.series.length ? (
          <RankChart history={rankHistory} />
        ) : (
          <div className="rank-chart empty-panel">
            <p>
              {board.error ??
                (ranker === "both" && board.rows.length
                  ? "Overlap is on the heatmap. The 24h chart only draws names that appear in both rankers’ top 5 this window."
                  : "Need at least one hourly snapshot to draw holds.")}
            </p>
          </div>
        )}
      </section>

      <section className="glass panel" id="flow">
        <div className="panel-head">
          <h2>
            {ranker === "both"
              ? "hyperliquid overlap movers · vs last hour"
              : `hyperliquid ${n} bagrank movers · vs last hour`}
          </h2>
        </div>
        {board.rows.length ? (
          <CrowdMovers rows={board.rows} />
        ) : (
          <div className="movers empty-panel">
            <p>{board.error ?? "Need a snapshot before crowd flow can move."}</p>
          </div>
        )}
      </section>

      <section className="glass panel">
        <div className="panel-head">
          <h2>
            {ranker === "both"
              ? "hyperliquid overlap leaderboard"
              : `hyperliquid ${n} bagrank leaderboard`}
          </h2>
        </div>
        {board.rows.length ? (
          <Leaderboard rows={board.rows} />
        ) : (
          <p className="empty-copy">
            {board.error ?? "No pairs yet."}
          </p>
        )}
      </section>
    </main>
  );
}
