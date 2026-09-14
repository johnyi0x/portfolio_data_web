"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RankHistory, RankHistoryPoint, RankHistorySeries } from "@/lib/board-data";

const LINE = ["#30d18d", "#64d2ff", "#ff9f0a", "#bf5af2", "#ff453a"];

function colorOf(i: number): string {
  return LINE[i % LINE.length];
}

function holdLabel(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function deltaLabel(from: number, to: number): string {
  const d = Math.round((to - from) * 1000) / 10;
  if (Math.abs(d) < 0.05) return "0.0";
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
}

function hourLabel(ts: number, compact: boolean): string {
  const h = new Date(ts).getUTCHours();
  if (compact) return `${String(h).padStart(2, "0")}:00`;
  const hour = h % 12 || 12;
  return `${hour}${h < 12 ? "am" : "pm"}`;
}

function pointAt(series: RankHistorySeries, ts: number): RankHistoryPoint | null {
  for (const p of series.points) {
    if (p.ts === ts) return p;
  }
  return null;
}

function monotonePath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dx[i] ? dy[i] / dx[i] : 0);
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-8) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const q = 3 / Math.sqrt(s);
      t[i] = q * a * m[i];
      t[i + 1] = q * b * m[i];
    }
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i].x + dx[i] / 3;
    const y1 = pts[i].y + (t[i] * dx[i]) / 3;
    const x2 = pts[i + 1].x - dx[i] / 3;
    const y2 = pts[i + 1].y - (t[i + 1] * dx[i]) / 3;
    d += ` C${x1} ${y1}, ${x2} ${y2}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

function areaPath(pts: { x: number; y: number }[], yBase: number): string {
  const line = monotonePath(pts);
  if (!line || !pts.length) return "";
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L${last.x} ${yBase} L${first.x} ${yBase} Z`;
}

function niceMax(raw: number): number {
  const pct = Math.max(0.08, raw * 1.08);
  const step = pct > 0.4 ? 0.1 : pct > 0.2 ? 0.05 : 0.02;
  return Math.ceil(pct / step) * step;
}

function yTicks(max: number): number[] {
  const step = max > 0.4 ? 0.1 : max > 0.2 ? 0.05 : 0.02;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

export function RankChart({ history }: { history: RankHistory }) {
  const wrap = useRef<HTMLDivElement>(null);
  const fillId = `hold-fill-${useId().replace(/:/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 240 });
  const [hover, setHover] = useState<number | null>(null);
  const [hoverCoin, setHoverCoin] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const hoverRef = useRef<number | null>(null);
  const coinRef = useRef<string | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(0, r.width), h: Math.max(180, r.height) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (pin && !history.series.some((s) => s.coin === pin)) setPin(null);
  }, [history.series, pin]);

  const hours = history.hours;
  const compact = size.w > 0 && size.w < 640;
  const pad = compact
    ? { top: 10, right: 34, bottom: 22, left: 8 }
    : { top: 12, right: 40, bottom: 24, left: 10 };
  const plotW = Math.max(1, size.w - pad.left - pad.right);
  const plotH = Math.max(1, size.h - pad.top - pad.bottom);

  const yMax = useMemo(() => {
    let m = 0;
    for (const s of history.series) {
      for (const p of s.points) m = Math.max(m, p.holdPct);
    }
    return niceMax(m);
  }, [history.series]);

  const xAt = (i: number) => {
    if (hours.length <= 1) return pad.left + plotW;
    return pad.left + (i / (hours.length - 1)) * plotW;
  };
  const yAt = (pct: number) => pad.top + (1 - pct / yMax) * plotH;
  const yBase = pad.top + plotH;

  const seriesPaint = useMemo(() => {
    return history.series.map((s, i) => {
      const pts = hours.flatMap((h, idx) => {
        const p = pointAt(s, h.ts);
        if (!p) return [];
        return [{ x: xAt(idx), y: yAt(p.holdPct), p, idx }];
      });
      const last = pts[pts.length - 1];
      const first = pts[0];
      const flips = pts.filter((pt, n) => n > 0 && pt.p.side !== pts[n - 1].p.side);
      return {
        s,
        color: colorOf(i),
        pts,
        d: monotonePath(pts),
        area: areaPath(pts, yBase),
        last,
        first,
        flips,
      };
    });
  }, [history.series, hours, plotH, plotW, pad.left, pad.top, yMax, yBase]);

  if (!hours.length || !history.series.length) {
    return (
      <div className="rank-chart empty-panel">
        <p>Need a few hourly snapshots to draw 24h holds.</p>
      </div>
    );
  }

  const hoverIdx = hover == null ? hours.length - 1 : hover;
  const hoverHour = hours[hoverIdx];
  const ticks = compact
    ? [0, Number((yMax / 2).toFixed(4)), yMax]
    : yTicks(yMax);
  const xTicks =
    hours.length < 3
      ? hours.map((h, i) => ({ h, i }))
      : compact
        ? [0, hours.length - 1].map((i) => ({ h: hours[i], i }))
        : [0, Math.floor((hours.length - 1) / 2), hours.length - 1].map((i) => ({
            h: hours[i],
            i,
          }));

  const selectedCoin = pin ?? seriesPaint[0]?.s.coin ?? null;
  const focusCoin = pin ?? (!compact ? hoverCoin : null) ?? selectedCoin;
  const dimming = Boolean(pin) || (!compact && Boolean(hoverCoin));
  const focus = seriesPaint.find((row) => row.s.coin === focusCoin) ?? seriesPaint[0];
  const focusLive = hoverHour && focus ? pointAt(focus.s, hoverHour.ts) : focus?.last?.p;
  const stampShort = hoverHour?.stamp ? `${hoverHour.stamp.slice(11, 16)} UTC` : "";

  return (
    <div className="rank-wrap">
      <div className="rank-legend" role="list">
        <p className="rank-legend-time">{hover == null ? "now" : stampShort}</p>
        {seriesPaint.map(({ s, color, first, last }) => {
          const live = hoverHour ? pointAt(s, hoverHour.ts) : last?.p;
          const on = (compact ? selectedCoin : focusCoin) === s.coin;
          const delta = first && last ? deltaLabel(first.p.holdPct, last.p.holdPct) : null;
          const deltaN = first && last ? last.p.holdPct - first.p.holdPct : 0;
          return (
            <button
              key={s.coin}
              type="button"
              role="listitem"
              className={on ? "on" : undefined}
              style={{ "--swatch": color } as CSSProperties}
              onClick={() => setPin((cur) => (cur === s.coin ? null : s.coin))}
            >
              <i />
              <b>{s.label}</b>
              {live ? <span className="rank-leg-pct">{holdLabel(live.holdPct)}</span> : null}
              {live ? <span className={live.side}>{live.side}</span> : null}
              {delta ? (
                <em
                  title="24h change in hold %"
                  className={deltaN > 0.0005 ? "up" : deltaN < -0.0005 ? "down" : undefined}
                >
                  {delta}
                </em>
              ) : null}
            </button>
          );
        })}
      </div>
      <div ref={wrap} className="rank-chart">
        {size.w > 8 ? (
          <svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${Math.max(1, size.w)} ${size.h}`}
            role="img"
            aria-label="Crowd hold percent for the current top 5 pairs over the last 24 hours"
            onPointerMove={(event) => {
              if (!hours.length || !size.w) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;
              const idx =
                hours.length <= 1
                  ? 0
                  : Math.round(((x - pad.left) / plotW) * (hours.length - 1));
              const next = Math.min(hours.length - 1, Math.max(0, idx));
              const hour = hours[next];
              let nearest: string | null = pin ?? (compact ? history.series[0]?.coin ?? null : null);
              if (!compact && !pin && hour) {
                let best = Infinity;
                for (const row of seriesPaint) {
                  const p = pointAt(row.s, hour.ts);
                  if (!p) continue;
                  const dist = Math.abs(yAt(p.holdPct) - y);
                  if (dist < best) {
                    best = dist;
                    nearest = row.s.coin;
                  }
                }
              }
              if (hoverRef.current === next && coinRef.current === nearest) return;
              hoverRef.current = next;
              coinRef.current = nearest;
              cancelAnimationFrame(frame.current);
              frame.current = requestAnimationFrame(() => {
                setHover(next);
                setHoverCoin(nearest);
              });
            }}
            onPointerLeave={() => {
              cancelAnimationFrame(frame.current);
              hoverRef.current = null;
              coinRef.current = null;
              setHover(null);
              setHoverCoin(null);
            }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={focus?.color ?? LINE[0]} stopOpacity="0.22" />
                <stop offset="100%" stopColor={focus?.color ?? LINE[0]} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={pad.left + plotW}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  className="rank-grid"
                />
                <text
                  x={pad.left + plotW + 6}
                  y={yAt(tick) + 3}
                  className="rank-axis"
                  textAnchor="start"
                >
                  {Math.round(tick * 100)}%
                </text>
              </g>
            ))}
            {xTicks.map(({ h, i }) => (
              <text
                key={h.ts}
                x={xAt(i)}
                y={size.h - 6}
                className="rank-axis"
                textAnchor={i === 0 ? "start" : i === hours.length - 1 ? "end" : "middle"}
              >
                {hourLabel(h.ts, compact)}
              </text>
            ))}
            {focus?.area ? (
              <path d={focus.area} fill={`url(#${fillId})`} stroke="none" />
            ) : null}
            {seriesPaint.map(({ s, color, d }) => {
              const focused = s.coin === focusCoin;
              const on = !dimming || focused;
              return (
                <path
                  key={s.coin}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={focused ? 2.15 : 1.3}
                  strokeOpacity={on ? (focused ? 1 : 0.72) : 0.16}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}
            {focus?.flips.map((pt) => (
              <rect
                key={`${focus.s.coin}-flip-${pt.idx}`}
                x={pt.x - 3}
                y={pt.y - 3}
                width={6}
                height={6}
                rx={1}
                transform={`rotate(45 ${pt.x} ${pt.y})`}
                fill="var(--bg)"
                stroke={focus.color}
                strokeWidth={1.2}
              />
            ))}
            {seriesPaint.map(({ s, color, last }) => {
              if (!last) return null;
              const on = !dimming || focusCoin === s.coin;
              const live = hoverHour ? pointAt(s, hoverHour.ts) : last.p;
              const showHover = hover != null && live && s.coin === focusCoin;
              return (
                <g key={`${s.coin}-dot`} opacity={on ? 1 : 0.18}>
                  <circle cx={last.x} cy={last.y} r={on ? 3.1 : 2.2} fill={color} />
                  {showHover ? (
                    <circle
                      cx={xAt(hoverIdx)}
                      cy={yAt(live.holdPct)}
                      r={4}
                      fill={color}
                      stroke="var(--bg)"
                      strokeWidth={1.4}
                    />
                  ) : null}
                </g>
              );
            })}
            {hover != null && hoverHour ? (
              <>
                <line
                  x1={xAt(hoverIdx)}
                  x2={xAt(hoverIdx)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  className="rank-cross"
                />
                {focusLive ? (
                  <line
                    x1={pad.left}
                    x2={pad.left + plotW}
                    y1={yAt(focusLive.holdPct)}
                    y2={yAt(focusLive.holdPct)}
                    className="rank-cross"
                  />
                ) : null}
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
