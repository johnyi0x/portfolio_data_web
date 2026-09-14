import type { PairRow } from "@/lib/board";

export function tileFill(row: PairRow): string {
  const a = 0.18 + row.agreement * 0.42;
  if (row.side === "long") return `rgba(48, 209, 141, ${a})`;
  return `rgba(255, 69, 58, ${a})`;
}

export function markBox(width: number) {
  const w = Math.min(170, Math.max(108, width * 0.4));
  const h = width < 720 ? 26 : 30;
  return { x: Math.max(0, width - w - 10), y: 5, w, h };
}

export function overlapTop(
  rect: { x: number; y: number; w: number; h: number },
  box: ReturnType<typeof markBox>,
) {
  const ox = Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x);
  const oy = Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y);
  if (ox <= 0 || oy <= 0) return 0;
  return Math.ceil(oy + 6);
}

export function tileType(
  width: number,
  height: number,
  label: string,
  dex: string,
  extraTop: number,
  scale = 1,
) {
  const s = scale > 0 ? scale : 1;
  const padX = Math.max(3 * s, Math.min(10 * s, width * 0.07));
  const padY = Math.max(2 * s, Math.min(8 * s, height * 0.08));
  const innerW = Math.max(8 * s, width - padX * 2);
  const innerH = Math.max(8 * s, height - padY * 2 - extraTop);
  const extra = dex ? dex.length * 0.55 + 1.2 : 0;
  const chars = Math.max(2, label.length + extra);
  const pair = Math.max(
    5 * s,
    Math.min(16 * s, innerW / (chars * 0.7), innerH * 0.5),
  );
  const meta = Math.max(6 * s, Math.min(11 * s, pair * 0.72));
  const sub = Math.max(6 * s, Math.min(10 * s, pair * 0.64));
  const showMeta = innerH >= pair * 1.2 + meta * 1.25 + 6 * s && width >= 52 * s;
  const showSub =
    showMeta && innerH >= pair * 1.2 + meta * 1.25 + sub * 1.25 + 10 * s && width >= 84 * s;
  return { padX, padY, pair, meta, sub, showMeta, showSub };
}
