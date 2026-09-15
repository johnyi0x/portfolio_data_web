import type { PairRow } from "@/lib/board";

/** Approx glyph width / font-size for bold ticker text. */
const LABEL_EM = 0.64;
/** Dex badge is smaller + mono + letter-spacing. */
const DEX_EM = 0.78;
const LINE = 1.08;
const GAP = 1.5;
const BORDER = 2; // 1px each side on .heat-cell

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

export type TileType = {
  padX: number;
  padY: number;
  pair: number;
  meta: number;
  sub: number;
  showPair: boolean;
  showMeta: boolean;
  showSub: boolean;
  showDex: boolean;
};

function pairWidth(font: number, label: string, dex: string, withDex: boolean): number {
  const labelW = Math.max(1, label.length) * font * LABEL_EM;
  if (!withDex || !dex) return labelW;
  const dexFont = Math.max(5, font * 0.58);
  const gap = font * 0.35;
  return labelW + gap + dex.length * dexFont * DEX_EM;
}

function lineH(font: number): number {
  return font * LINE;
}

/**
 * Pick what fits inside a treemap cell without cropping.
 * Prefer dropping dex → sub → meta → pair over clipping mid-glyph.
 */
export function tileType(
  width: number,
  height: number,
  label: string,
  dex: string,
  extraTop: number,
  scale = 1,
): TileType {
  const s = scale > 0 ? scale : 1;
  const boxW = Math.max(0, width - BORDER);
  const boxH = Math.max(0, height - BORDER);

  const padX = Math.max(2 * s, Math.min(8 * s, boxW * 0.06));
  const padY = Math.max(2 * s, Math.min(6 * s, boxH * 0.06));
  const innerW = Math.max(0, boxW - padX * 2);
  const innerH = Math.max(0, boxH - padY * 2 - extraTop);

  const empty: TileType = {
    padX,
    padY,
    pair: 0,
    meta: 0,
    sub: 0,
    showPair: false,
    showMeta: false,
    showSub: false,
    showDex: false,
  };

  if (innerW < 10 * s || innerH < 9 * s) return empty;

  const minPair = 6 * s;
  const maxPair = Math.min(16 * s, innerH * 0.72, innerW / 2.2);

  const tryFit = (withMeta: boolean, withSub: boolean, withDex: boolean) => {
    const metaBase = withMeta ? Math.min(11 * s, Math.max(6 * s, maxPair * 0.7)) : 0;
    const subBase = withSub ? Math.min(10 * s, Math.max(6 * s, maxPair * 0.62)) : 0;
    // Pair gets leftover height after reserved meta/sub (+ gaps).
    const reserved =
      (withMeta ? lineH(metaBase) + GAP * s : 0) +
      (withSub ? lineH(subBase) + GAP * s : 0);
    const pairBudgetH = Math.max(0, innerH - reserved);
    if (pairBudgetH < minPair * LINE) return null;

    let lo = minPair;
    let hi = Math.min(maxPair, pairBudgetH / LINE);
    let best = 0;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (pairWidth(mid, label, dex, withDex) <= innerW && lineH(mid) <= pairBudgetH + 0.01) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    if (best < minPair - 0.01) return null;

    const pair = Math.floor(best * 10) / 10;
    const meta = withMeta
      ? Math.min(metaBase, Math.max(6 * s, pair * 0.7), innerW / 7)
      : 0;
    const sub = withSub
      ? Math.min(subBase, Math.max(6 * s, pair * 0.62), innerW / 9)
      : 0;

    const totalH =
      lineH(pair) +
      (withMeta ? GAP * s + lineH(meta) : 0) +
      (withSub ? GAP * s + lineH(sub) : 0);
    if (totalH > innerH + 0.5) return null;
    if (withMeta && pairWidth(meta, "SHORT 99.9%", "", false) > innerW) return null;

    return { pair, meta, sub, withDex };
  };

  // Richest layout first; degrade until something fits.
  const attempts: [boolean, boolean, boolean][] = [
    [true, true, Boolean(dex)],
    [true, false, Boolean(dex)],
    [true, true, false],
    [true, false, false],
    [false, false, Boolean(dex)],
    [false, false, false],
  ];

  for (const [withMeta, withSub, withDex] of attempts) {
    if (withSub && !withMeta) continue;
    const fit = tryFit(withMeta, withSub, withDex);
    if (!fit) continue;
    return {
      padX,
      padY,
      pair: fit.pair,
      meta: fit.meta,
      sub: fit.sub,
      showPair: true,
      showMeta: withMeta,
      showSub: withSub,
      showDex: withDex && Boolean(dex),
    };
  }

  return empty;
}
