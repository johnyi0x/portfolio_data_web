"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PairRow } from "@/lib/board";
import { squarify } from "@/lib/squarify";

function tileFill(row: PairRow): string {
  const a = 0.18 + row.agreement * 0.42;
  if (row.side === "long") return `rgba(48, 209, 141, ${a})`;
  return `rgba(255, 69, 58, ${a})`;
}

export function Heatmap({ rows }: { rows: PairRow[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const rects = useMemo(() => {
    return squarify(
      rows.map((row) => ({ id: row.coin, value: row.holdPct })),
      size.w,
      size.h,
    );
  }, [rows, size.h, size.w]);

  const byCoin = useMemo(() => {
    return new Map(rows.map((row) => [row.coin, row]));
  }, [rows]);

  return (
    <div
      ref={wrap}
      className="heatmap"
      role="img"
      aria-label="Majority portfolio heatmap by hold percent"
    >
      {rects.map((rect) => {
        const row = byCoin.get(rect.id);
        if (!row || rect.w < 2 || rect.h < 2) return null;
        const compact = rect.w < 88 || rect.h < 56;
        const tiny = rect.w < 64 || rect.h < 42;
        return (
          <div
            key={row.coin}
            className="heat-cell"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              background: tileFill(row),
            }}
          >
            <span className="heat-pair">
              {row.label}
              {row.dex ? <em>{row.dex}</em> : null}
            </span>
            {!tiny ? (
              <span className="heat-meta">
                {row.side.toUpperCase()} {Math.round(row.holdPct * 1000) / 10}%
              </span>
            ) : null}
            {!compact ? (
              <span className="heat-sub">
                {row.wallets}/{row.onCoin} · agr {Math.round(row.agreement * 100)}% · {row.leverage}x
              </span>
            ) : null}
          </div>
        );
      })}
      <span className="heat-mark" aria-hidden="true">
        bagindex
      </span>
    </div>
  );
}
