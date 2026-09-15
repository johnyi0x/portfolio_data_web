"use client";

import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import { formatPxCompact, type PairRow } from "@/lib/board";
import {
  markBox,
  overlapTop,
  tileFill,
  tileType,
} from "@/lib/heatmap-layout";
import { squarify } from "@/lib/squarify";

/** After paint, shrink/hide lines that still overflow (font metrics vary by device). */
function fitHeatCells(root: HTMLElement) {
  const cells = root.querySelectorAll<HTMLElement>(".heat-cell");
  cells.forEach((cell) => {
    const pair = cell.querySelector<HTMLElement>(".heat-pair");
    const meta = cell.querySelector<HTMLElement>(".heat-meta");
    const sub = cell.querySelector<HTMLElement>(".heat-sub");
    if (!pair) return;

    const style = getComputedStyle(cell);
    const padX =
      (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY =
      (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availW = cell.clientWidth - padX;
    const availH = cell.clientHeight - padY;
    if (availW < 4 || availH < 4) {
      pair.style.visibility = "hidden";
      if (meta) meta.style.display = "none";
      if (sub) sub.style.display = "none";
      return;
    }

    pair.style.visibility = "visible";
    if (meta) meta.style.display = "";
    if (sub) sub.style.display = "";

    const contentH = () => {
      let h = pair.offsetHeight;
      if (meta && meta.style.display !== "none") h += meta.offsetHeight + 1.5;
      if (sub && sub.style.display !== "none") h += sub.offsetHeight + 1.5;
      return h;
    };

    let size = parseFloat(pair.style.fontSize) || parseFloat(getComputedStyle(pair).fontSize);
    const min = 5;
    let guard = 0;
    while (
      guard++ < 40 &&
      size > min &&
      (pair.scrollWidth > availW + 0.5 || contentH() > availH + 0.5)
    ) {
      size -= 0.5;
      pair.style.fontSize = `${size}px`;
      const dex = pair.querySelector<HTMLElement>("em");
      if (dex) dex.style.fontSize = `${Math.max(5, size * 0.58)}px`;
    }

    // Drop secondary lines before cropping the ticker.
    if (sub && (pair.scrollWidth > availW + 0.5 || contentH() > availH + 0.5)) {
      sub.style.display = "none";
    }
    if (meta && (pair.scrollWidth > availW + 0.5 || contentH() > availH + 0.5)) {
      meta.style.display = "none";
    }

    // Last resort: hide dex badge, then ticker if still impossible.
    const dex = pair.querySelector<HTMLElement>("em");
    if (dex && pair.scrollWidth > availW + 0.5) {
      dex.style.display = "none";
    }
    if (pair.scrollWidth > availW + 0.5 || contentH() > availH + 0.5) {
      pair.style.visibility = "hidden";
    }
  });
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

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el || !size.w) return;
    fitHeatCells(el);
  }, [rects, size.w, size.h, rows]);

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
        ].join(" · ");
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
                <span className="heat-label">{row.label}</span>
                {type.showDex && row.dex ? (
                  <em style={{ fontSize: `${Math.max(5, type.pair * 0.58)}px` }}>
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
                {row.wallets}/{row.onCoin} · agr {Math.round(row.agreement * 100)}%
                {row.price ? ` · ${formatPxCompact(row.price)}` : ""} · {row.leverage}x
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
