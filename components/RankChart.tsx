"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RankHistory, RankHistoryPoint, RankHistorySeries } from "@/lib/board-data";

const LINE = [
  "#30d18d",
  "#ff453a",
  "#64d2ff",
  "#ff9f0a",
  "#bf5af2",
  "#ffd60a",
  "#5ac8fa",
  "#ff6b8a",
  "#a78bfa",
  "#34d399",
];

const PAD = { top: 18, right: 118, bottom: 28, left: 28 };
const RANK_MAX = 10;

function colorOf(i: number): string {
  return LINE[i % LINE.length];
}

function holdPct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function hourLabel(ts: number): string {
  const h = new Date(ts).getUTCHours();
  const hour = h % 12 || 12;
  return `${hour}${h < 12 ? "am" : "pm"} UTC`;
}

function pointAt(series: RankHistorySeries, ts: number): RankHistoryPoint | null {
  for (const p of series.points) {
    if (p.ts === ts) return p;
  }
  return null;
}

export function RankChart({ history }: { history: RankHistory }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 320 });
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(0, r.width), h: Math.max(240, r.height) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hours = history.hours;
  const plotW = Math.max(1, size.w - PAD.left - PAD.right);
  const plotH = Math.max(1, size.h - PAD.top - PAD.bottom);

  const seriesPaint = useMemo(() => {
    const xAt = (i: number) => {
      if (hours.length <= 1) return PAD.left + plotW;
      return PAD.left + (i / (hours.length - 1)) * plotW;
    };
    const yAt = (rank: number) => {
      const r = Math.min(RANK_MAX, Math.max(1, rank));
      return PAD.top + ((r - 1) / (RANK_MAX - 1)) * plotH;
    };
    return history.series.map((s, i) => {
      const pts = hours.flatMap((h, idx) => {
        const p = pointAt(s, h.ts);
        if (!p || p.rank > RANK_MAX) return [];
        return [{ x: xAt(idx), y: yAt(p.rank), p, idx }];
      });
      let d = "";
      let prevIdx = -99;
      for (const pt of pts) {
        d += pt.idx === prevIdx + 1 ? `L${pt.x} ${pt.y}` : `M${pt.x} ${pt.y}`;
        prevIdx = pt.idx;
      }
      return { s, color: colorOf(i), pts, d };
    });
  }, [history.series, hours, plotH, plotW]);

  const xAt = (i: number) => {
    if (hours.length <= 1) return PAD.left + plotW;
    return PAD.left + (i / (hours.length - 1)) * plotW;
  };
  const yAt = (rank: number) => {
    const r = Math.min(RANK_MAX, Math.max(1, rank));
    return PAD.top + ((r - 1) / (RANK_MAX - 1)) * plotH;
  };

  const hoverIdx = hover == null ? hours.length - 1 : hover;
  const hoverHour = hours[hoverIdx];

  if (!hours.length || !history.series.length) {
    return (
      <div className="rank-chart empty-panel">
        <p>Need a few hourly snapshots to draw 24h ranks.</p>
      </div>
    );
  }

  const ticks = [1, 4, 7, 10];
  const xTicks =
    hours.length < 3
      ? hours.map((h, i) => ({ h, i }))
      : [0, Math.floor((hours.length - 1) / 2), hours.length - 1].map((i) => ({
          h: hours[i],
          i,
        }));

  const tipX = hoverHour ? xAt(hoverIdx) : 0;
  const tipSide = tipX > size.w * 0.55 ? "left" : "right";

  return (
    <div ref={wrap} className="rank-chart">
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${Math.max(1, size.w)} ${size.h}`}
        role="img"
        aria-label="Top 10 pair ranks over the last 24 hours"
        onPointerMove={(event) => {
          if (!hours.length || !size.w) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const idx =
            hours.length <= 1
              ? 0
              : Math.round(((x - PAD.left) / plotW) * (hours.length - 1));
          const next = Math.min(hours.length - 1, Math.max(0, idx));
          if (hoverRef.current === next) return;
          hoverRef.current = next;
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => setHover(next));
        }}
        onPointerLeave={() => {
          cancelAnimationFrame(frame.current);
          hoverRef.current = null;
          setHover(null);
        }}
      >
        {ticks.map((rank) => (
          <g key={rank}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={yAt(rank)}
              y2={yAt(rank)}
              className="rank-grid"
            />
            <text x={4} y={yAt(rank) + 4} className="rank-axis" textAnchor="start">
              {rank}
            </text>
          </g>
        ))}
        {xTicks.map(({ h, i }) => (
          <text
            key={h.ts}
            x={xAt(i)}
            y={size.h - 8}
            className="rank-axis"
            textAnchor={i === 0 ? "start" : i === hours.length - 1 ? "end" : "middle"}
          >
            {hourLabel(h.ts)}
          </text>
        ))}
        {hover != null && hoverHour ? (
          <line
            x1={xAt(hoverIdx)}
            x2={xAt(hoverIdx)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="rank-cross"
          />
        ) : null}
        {seriesPaint.map(({ s, color, d }) => (
          <path
            key={s.coin}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {seriesPaint.map(({ s, color, pts }) => {
          const last = pts[pts.length - 1];
          if (!last) return null;
          const live = hoverHour ? pointAt(s, hoverHour.ts) : last.p;
          const hx = xAt(hoverIdx);
          const hy = live && live.rank <= RANK_MAX ? yAt(live.rank) : null;
          return (
            <g key={`${s.coin}-dots`}>
              <circle className="rank-pulse" cx={last.x} cy={last.y} r={11} fill={color} />
              <circle cx={last.x} cy={last.y} r={3.4} fill={color} />
              {hy != null && hover != null ? (
                <g>
                  <circle className="rank-hot" cx={hx} cy={hy} r={10} fill={color} />
                  <circle
                    cx={hx}
                    cy={hy}
                    r={3.8}
                    fill={color}
                    stroke="var(--ink)"
                    strokeWidth={1.3}
                  />
                </g>
              ) : null}
              <text x={last.x + 10} y={last.y + 4} className="rank-end" fill={color}>
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && hoverHour ? (
        <div
          className={`rank-tip ${tipSide}`}
          style={{
            left: tipSide === "right" ? Math.min(size.w - 220, tipX + 12) : undefined,
            right: tipSide === "left" ? Math.min(size.w - 12, size.w - tipX + 12) : undefined,
          }}
        >
          <p className="rank-tip-time">{hoverHour.stamp} UTC</p>
          <ul>
            {seriesPaint
              .map(({ s, color }) => {
                const p = pointAt(s, hoverHour.ts);
                if (!p) return null;
                return { s, color, p };
              })
              .filter((row): row is { s: RankHistorySeries; color: string; p: RankHistoryPoint } => row != null)
              .sort((a, b) => a.p.rank - b.p.rank)
              .map(({ s, color, p }) => (
                <li key={s.coin}>
                  <i style={{ background: color }} />
                  <b>{s.label}</b>
                  {s.dex ? <em>{s.dex}</em> : null}
                  <span className={p.side}>{p.side.toUpperCase()}</span>
                  <span>{holdPct(p.holdPct)}</span>
                  <span className="muted">#{p.rank}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
