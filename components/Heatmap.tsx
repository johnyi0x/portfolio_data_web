"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PairRow } from "@/lib/board";
import { squarify } from "@/lib/squarify";

function tileFill(row: PairRow): string {
  const a = 0.18 + row.agreement * 0.42;
  if (row.side === "long") return `rgba(48, 209, 141, ${a})`;
  return `rgba(255, 69, 58, ${a})`;
}

function markBox(width: number) {
  const w = Math.min(170, Math.max(108, width * 0.4));
  const h = width < 720 ? 26 : 30;
  return { x: Math.max(0, width - w - 10), y: 5, w, h };
}

function overlapTop(rect: { x: number; y: number; w: number; h: number }, box: ReturnType<typeof markBox>) {
  const ox = Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x);
  const oy = Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y);
  if (ox <= 0 || oy <= 0) return 0;
  return Math.ceil(oy + 6);
}

function tileType(
  width: number,
  height: number,
  label: string,
  dex: string,
  extraTop: number,
) {
  const padX = Math.max(3, Math.min(10, width * 0.07));
  const padY = Math.max(2, Math.min(8, height * 0.08));
  const innerW = Math.max(8, width - padX * 2);
  const innerH = Math.max(8, height - padY * 2 - extraTop);
  const extra = dex ? dex.length * 0.55 + 1.2 : 0;
  const chars = Math.max(2, label.length + extra);
  const pair = Math.max(
    5,
    Math.min(16, innerW / (chars * 0.7), innerH * 0.5),
  );
  const meta = Math.max(6, Math.min(11, pair * 0.72));
  const sub = Math.max(6, Math.min(10, pair * 0.64));
  const showMeta = innerH >= pair * 1.2 + meta * 1.25 + 6 && width >= 52;
  const showSub =
    showMeta && innerH >= pair * 1.2 + meta * 1.25 + sub * 1.25 + 10 && width >= 84;
  return { padX, padY, pair, meta, sub, showMeta, showSub };
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
        return (
          <div
            key={row.coin}
            className="heat-cell"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              padding: `${type.padY + extraTop}px ${type.padX}px ${type.padY}px`,
              background: tileFill(row),
            }}
          >
            <span className="heat-pair" style={{ fontSize: `${type.pair}px` }}>
              {row.label}
              {row.dex ? (
                <em style={{ fontSize: `${Math.max(5, type.pair * 0.58)}px` }}>
                  {row.dex}
                </em>
              ) : null}
            </span>
            {type.showMeta ? (
              <span className="heat-meta" style={{ fontSize: `${type.meta}px` }}>
                {row.side.toUpperCase()} {Math.round(row.holdPct * 1000) / 10}%
              </span>
            ) : null}
            {type.showSub ? (
              <span className="heat-sub" style={{ fontSize: `${type.sub}px` }}>
                {row.wallets}/{row.onCoin} · agr {Math.round(row.agreement * 100)}% · {row.leverage}x
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
