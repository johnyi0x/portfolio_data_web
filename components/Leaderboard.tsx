import type { PairRow } from "@/lib/board";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function Leaderboard({ rows }: { rows: PairRow[] }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Pair</th>
            <th>Side</th>
            <th className="num">Hold</th>
            <th className="num">Wallets</th>
            <th className="num">On coin</th>
            <th>L / S</th>
            <th className="num">Agree</th>
            <th className="num">Lev</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.coin}>
              <td className="num muted">{String(row.rank).padStart(2, "0")}</td>
              <td>
                <span className="pair">
                  {row.label}
                  {row.dex ? <span className="dex">{row.dex}</span> : null}
                </span>
              </td>
              <td>
                <span className={row.side === "long" ? "tag long" : "tag short"}>
                  {row.side}
                </span>
              </td>
              <td className="num">{pct(row.holdPct)}</td>
              <td className="num">{row.wallets}</td>
              <td className="num">{row.onCoin}</td>
              <td className="split">
                <span className="long-t">{row.longN}</span>
                <span className="muted">/</span>
                <span className="short-t">{row.shortN}</span>
              </td>
              <td className="num">{pct(row.agreement)}</td>
              <td className="num">{row.leverage}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
