export type TreemapNode = {
  id: string;
  value: number;
};

export type TreemapRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Box = { x: number; y: number; w: number; h: number };

function worst(row: TreemapNode[], w: number): number {
  const s = row.reduce((a, b) => a + b.value, 0);
  if (s <= 0) return Infinity;
  let worstRatio = 0;
  for (const n of row) {
    const r = (w * w * n.value) / (s * s);
    worstRatio = Math.max(worstRatio, r, 1 / r);
  }
  return worstRatio;
}

function layoutRow(row: TreemapNode[], box: Box, vertical: boolean): TreemapRect[] {
  const s = row.reduce((a, b) => a + b.value, 0);
  const out: TreemapRect[] = [];
  let offset = 0;
  for (const n of row) {
    const frac = n.value / s;
    if (vertical) {
      const h = box.h * frac;
      out.push({ id: n.id, x: box.x, y: box.y + offset, w: box.w, h });
      offset += h;
    } else {
      const w = box.w * frac;
      out.push({ id: n.id, x: box.x + offset, y: box.y, w, h: box.h });
      offset += w;
    }
  }
  return out;
}

export function squarify(items: TreemapNode[], width: number, height: number): TreemapRect[] {
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0 || width <= 0 || height <= 0) return [];
  const nodes = items
    .filter((n) => n.value > 0)
    .map((n) => ({ ...n, value: (n.value / total) * width * height }))
    .sort((a, b) => b.value - a.value);

  const out: TreemapRect[] = [];
  const box: Box = { x: 0, y: 0, w: width, h: height };
  let row: TreemapNode[] = [];

  const shortest = () => Math.min(box.w, box.h);

  while (nodes.length) {
    const next = nodes[0];
    const w = shortest();
    if (row.length === 0 || worst([...row, next], w) <= worst(row, w)) {
      row.push(nodes.shift()!);
      continue;
    }
    const vertical = box.w >= box.h;
    const s = row.reduce((a, b) => a + b.value, 0);
    if (vertical) {
      const rw = s / box.h;
      out.push(...layoutRow(row, { x: box.x, y: box.y, w: rw, h: box.h }, true));
      box.x += rw;
      box.w -= rw;
    } else {
      const rh = s / box.w;
      out.push(...layoutRow(row, { x: box.x, y: box.y, w: box.w, h: rh }, false));
      box.y += rh;
      box.h -= rh;
    }
    row = [];
  }
  if (row.length) {
    const vertical = box.w >= box.h;
    out.push(...layoutRow(row, box, vertical));
  }
  return out;
}
