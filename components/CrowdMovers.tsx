import {
  formatChgPct,
  formatHoldDelta,
  type PairRow,
} from "@/lib/board";

const LIMIT = 8;
const MIN_MOVE = 0.002;
const PREV_FLOOR = 3;

type Mover = PairRow & { entered?: boolean };

function holdLabel(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function chgClass(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "muted";
  return n > 0 ? "up" : "down";
}

function splitMovers(rows: PairRow[]): {
  inflows: Mover[];
  outflows: Mover[];
} | null {
  const withPrev = rows.filter((row) => row.prevHoldPct != null).length;
  if (withPrev < PREV_FLOOR) return null;

  const movers: Mover[] = rows
    .map((row) => {
      if (row.holdDelta != null) return row;
      if (row.prevHoldPct == null) {
        return { ...row, holdDelta: row.holdPct, entered: true };
      }
      return row;
    })
    .filter(
      (row): row is Mover =>
        row.holdDelta != null && Math.abs(row.holdDelta) >= MIN_MOVE,
    );

  if (!movers.length) return { inflows: [], outflows: [] };

  const inflows = movers
    .filter((row) => (row.holdDelta ?? 0) > 0)
    .sort((a, b) => (b.holdDelta ?? 0) - (a.holdDelta ?? 0))
    .slice(0, LIMIT);
  const outflows = movers
    .filter((row) => (row.holdDelta ?? 0) < 0)
    .sort((a, b) => (a.holdDelta ?? 0) - (b.holdDelta ?? 0))
    .slice(0, LIMIT);

  return { inflows, outflows };
}

function MoverCol({
  title,
  rows,
  maxAbs,
  dir,
}: {
  title: string;
  rows: Mover[];
  maxAbs: number;
  dir: "in" | "out";
}) {
  return (
    <div className={`movers-col ${dir}`}>
      <h3>{title}</h3>
      {rows.length ? (
        <ol>
          {rows.map((row) => {
            const delta = row.holdDelta ?? 0;
            const width = Math.max(6, (Math.abs(delta) / maxAbs) * 100);
            return (
              <li key={row.coin}>
                <div className="movers-top">
                  <span className="pair">
                    {row.label}
                    {row.dex ? <span className="dex">{row.dex}</span> : null}
                    {row.entered ? <span className="movers-new">new</span> : null}
                  </span>
                  <span className={row.side === "long" ? "tag long" : "tag short"}>
                    {row.side}
                  </span>
                  <span className={delta >= 0 ? "movers-d up" : "movers-d down"}>
                    {formatHoldDelta(delta)}
                  </span>
                </div>
                <div className="movers-bar" aria-hidden="true">
                  <i className={row.side} style={{ width: `${width}%` }} />
                </div>
                <div className="movers-sub">
                  <span>hold {holdLabel(row.holdPct)}</span>
                  <span className={chgClass(row.changePct)}>
                    1h {formatChgPct(row.changePct)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="movers-none">None this hour.</p>
      )}
    </div>
  );
}

export function CrowdMovers({ rows }: { rows: PairRow[] }) {
  const split = splitMovers(rows);
  if (!split) {
    return (
      <div className="movers empty-panel">
        <p>Need the previous hourly snapshot to show crowd flow.</p>
      </div>
    );
  }

  const { inflows, outflows } = split;
  if (!inflows.length && !outflows.length) {
    return (
      <div className="movers empty-panel">
        <p>Hold % barely moved vs last hour.</p>
      </div>
    );
  }

  const maxAbs = Math.max(
    0.01,
    ...inflows.map((row) => Math.abs(row.holdDelta ?? 0)),
    ...outflows.map((row) => Math.abs(row.holdDelta ?? 0)),
  );

  return (
    <div className="movers">
      <MoverCol title="In this hour" rows={inflows} maxAbs={maxAbs} dir="in" />
      <MoverCol title="Out this hour" rows={outflows} maxAbs={maxAbs} dir="out" />
    </div>
  );
}
