"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPxCompact, type PairRow } from "@/lib/board";
import {
  markBox,
  overlapTop,
  tileFill,
  tileType,
} from "@/lib/heatmap-layout";
import { squarify } from "@/lib/squarify";

function subLine(row: PairRow, level: 0 | 1 | 2): string {
  if (level <= 0) return "";
  const core = `${row.wallets}/${row.onCoin} · agr ${Math.round(row.agreement * 100)}%`;
  if (level === 1) return core;
  return `${core}${row.price ? ` · ${formatPxCompact(row.price)}` : ""} · ${row.leverage}x`;
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

  const mark = markBox(size.w);

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
        const extraTop = overlapTop(rect, mark);
        const type = tileType(rect.w, rect.h, row.label, row.dex, extraTop);
        const tip = [
          row.dex ? `${row.label} (${row.dex})` : row.label,
          `${row.side} ${Math.round(row.holdPct * 1000) / 10}%`,
          `${row.wallets}/${row.onCoin} · agr ${Math.round(row.agreement * 100)}%`,
          row.price ? formatPxCompact(row.price) : null,
          `${row.leverage}x`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={row.coin}
            className="heat-cell"
            title={tip}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              padding: `${type.padY + extraTop}px ${type.padX}px ${type.padY}px`,
              background: tileFill(row),
            }}
          >
            {type.showPair ? (
              <span className="heat-pair" style={{ fontSize: `${type.pair}px` }}>
                {row.label}
                {type.showDex && row.dex ? (
                  <em style={{ fontSize: `${Math.max(6, type.pair * 0.55)}px` }}>
                    {row.dex}
                  </em>
                ) : null}
              </span>
            ) : null}
            {type.showMeta ? (
              <span className="heat-meta" style={{ fontSize: `${type.meta}px` }}>
                {row.side.toUpperCase()} {Math.round(row.holdPct * 1000) / 10}%
              </span>
            ) : null}
            {type.showSub ? (
              <span className="heat-sub" style={{ fontSize: `${type.sub}px` }}>
                {subLine(row, type.subLevel)}
              </span>
            ) : null}
          </div>
        );
      })}
      <span className="heat-mark" aria-hidden="true">
        bagrank.xyz
      </span>
    </div>
  );
}
