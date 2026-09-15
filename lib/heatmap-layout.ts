import type { PairRow } from "@/lib/board";

/** Conservative glyph width (bold ticker). Prefer blank over crop/ellipsis. */
const LABEL_EM = 0.72;
const DEX_EM = 0.82;
const LINE = 1.1;
const GAP = 2;
const BORDER = 2;

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
  /** 0 = hide, 1 = wallets/agr only, 2 = full sub line */
  subLevel: 0 | 1 | 2;
};

function widthAt(font: number, text: string, em: number): number {
  return Math.max(1, text.length) * font * em;
}

function pairLineWidth(font: number, label: string, dex: string, withDex: boolean): number {
  const labelW = widthAt(font, label, LABEL_EM);
  if (!withDex || !dex) return labelW;
  const dexFont = Math.max(6, font * 0.55);
  return labelW + font * 0.4 + widthAt(dexFont, dex, DEX_EM);
}

/**
 * Full ticker or nothing. Never ellipsis-truncate the symbol.
 * Drop dex / meta / sub when they don't fit.
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

  const padX = Math.max(3 * s, Math.min(9 * s, boxW * 0.07));
  const padY = Math.max(2 * s, Math.min(7 * s, boxH * 0.07));
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
    subLevel: 0,
  };

  // Readable floor: below this, leave the tile color-only.
  const minPair = 8 * s;
  if (innerW < minPair * 2 || innerH < minPair * LINE) return empty;

  const maxPair = Math.min(17 * s, innerH * 0.62, innerW / 2.4);

  const fitPair = (withDex: boolean): number => {
    let lo = minPair;
    let hi = maxPair;
    let best = 0;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (pairLineWidth(mid, label, dex, withDex) <= innerW) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return best >= minPair - 0.05 ? Math.floor(best * 10) / 10 : 0;
  };

  // Prefer full label without dex if dex would force a tiny font.
  let showDex = false;
  let pair = fitPair(false);
  if (!pair) return empty;

  if (dex) {
    const withDexSize = fitPair(true);
    // Only keep dex if we stay reasonably large (not crushing the ticker).
    if (withDexSize >= Math.max(minPair, pair * 0.82)) {
      pair = withDexSize;
      showDex = true;
    }
  }

  const meta = Math.min(11 * s, Math.max(7 * s, pair * 0.68));
  const sub = Math.min(10 * s, Math.max(7 * s, pair * 0.6));
  const metaText = "SHORT 99.9%";
  const canMeta =
    widthAt(meta, metaText, 0.62) <= innerW &&
    innerH >= pair * LINE + GAP * s + meta * LINE + 1;

  let showMeta = canMeta;
  let subLevel: 0 | 1 | 2 = 0;

  if (showMeta) {
    const used = pair * LINE + GAP * s + meta * LINE;
    const left = innerH - used - GAP * s;
    const shortSub = "99/99 · agr 99%";
    const fullSub = "99/99 · agr 99% · 9999.99 · 99x";
    if (left >= sub * LINE && widthAt(sub, fullSub, 0.58) <= innerW && innerW >= 100 * s) {
      subLevel = 2;
    } else if (left >= sub * LINE && widthAt(sub, shortSub, 0.58) <= innerW && innerW >= 72 * s) {
      subLevel = 1;
    }
  }

  // If meta + pair don't fit height, drop meta (keep ticker).
  if (showMeta && pair * LINE + GAP * s + meta * LINE > innerH) {
    showMeta = false;
    subLevel = 0;
  }

  return {
    padX,
    padY,
    pair,
    meta: showMeta ? meta : 0,
    sub: subLevel ? sub : 0,
    showPair: true,
    showMeta,
    showSub: subLevel > 0,
    showDex,
    subLevel,
  };
}
