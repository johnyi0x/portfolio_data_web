import { Heatmap } from "@/components/Heatmap";
import { Leaderboard } from "@/components/Leaderboard";
import { RankChart } from "@/components/RankChart";
import { RefreshMark } from "@/components/RefreshMark";
import { ShareOnX } from "@/components/ShareOnX";
import { getLatestBoard, getRankHistory } from "@/lib/board-data";
import { heatmapShareUrl, heatmapTweetText } from "@/lib/share";

export async function BoardHome() {
  const [board, rankHistory] = await Promise.all([
    getLatestBoard(),
    getRankHistory(),
  ]);
  const longs = board.rows.filter((r) => r.side === "long").length;
  const shorts = board.rows.length - longs;
  const n = board.listed;
  const top = board.rows[0];

  return (
    <main className="page">
      <section className="intro">
        <h1 className="intro-title">
          Top {n} Hyperliquid wallets by {board.rankWindow} BagRank Heatmap.
        </h1>
        <p className="intro-copy">
          Each of the {n} wallets gets one vote per pair they hold. The tile
          is how many of those wallets are in that pair (majority side).
          Biggest tile = most of the top {n} are in it. Crowd hold map, not
          average rank inside each book. Green is long, red is short. Native
          and HIP-3 builder perps (xyz, io, and others) count the same; the
          badge is the dex.
        </p>
        <div className="meta">
          <span>
            top {n} · {board.rankWindow}
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
          <h2>hyperliquid {n} bagrank heatmap</h2>
          <div className="panel-head-tools">
            <ShareOnX
              label="Share heatmap"
              text={heatmapTweetText(top, n)}
              url={heatmapShareUrl(board.cycleTs)}
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
          <h2>crowd hold · last 24h</h2>
        </div>
        {rankHistory.series.length ? (
          <RankChart history={rankHistory} />
        ) : (
          <div className="rank-chart empty-panel">
            <p>
              {board.error ?? "Need a few hourly snapshots to draw 24h holds."}
            </p>
          </div>
        )}
      </section>

      <section className="glass panel">
        <div className="panel-head">
          <h2>hyperliquid {n} bagrank leaderboard</h2>
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
