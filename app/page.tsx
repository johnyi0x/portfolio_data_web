import { Heatmap } from "@/components/Heatmap";
import { Leaderboard } from "@/components/Leaderboard";
import { RefreshMark } from "@/components/RefreshMark";
import { getLatestBoard } from "@/lib/board-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const board = await getLatestBoard();
  const longs = board.rows.filter((r) => r.side === "long").length;
  const shorts = board.rows.length - longs;
  const n = board.listed;

  return (
    <main className="page">
      <section className="intro">
        <h1 className="intro-title">
          Top {n} Hyperliquid wallets by {board.rankWindow} BagIndex Heatmap.
        </h1>
        <p className="intro-copy">
          Each of the {n} wallets gets one vote per pair they hold. The tile
          is how many of those wallets are in that pair (majority side).
          Biggest tile = most of the top {n} are in it. Crowd hold map, not
          average rank inside each book. Green is long, red is short.
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

      <section className="glass panel">
        <div className="panel-head">
          <h2>hyperliquid {n} bagindex heatmap</h2>
          <RefreshMark capturedAt={board.capturedAt} />
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

      <section className="glass panel">
        <div className="panel-head">
          <h2>hyperliquid {n} bagindex leaderboard</h2>
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
