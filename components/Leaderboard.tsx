"use client";

import { useEffect, useState } from "react";
import type { PairRow } from "@/lib/board";

const PAGE_SIZE = 20;

function RankMove({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className={up ? "rank-move up" : "rank-move down"}
      title={up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(delta)}
    </span>
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function Leaderboard({ rows }: { rows: PairRow[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  const from = rows.length ? start + 1 : 0;
  const to = Math.min(rows.length, start + slice.length);

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th className="num">rank#</th>
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
          {slice.map((row) => (
            <tr key={row.coin}>
              <td className="num muted">{String(row.rank).padStart(2, "0")}</td>
              <td>
                <span className="pair">
                  {row.label}
                  {row.dex ? <span className="dex">{row.dex}</span> : null}
                  <RankMove delta={row.rankDelta} />
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
      {rows.length > PAGE_SIZE ? (
        <nav className="pager" aria-label="Leaderboard pages">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span>
            {from}–{to} of {rows.length}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
