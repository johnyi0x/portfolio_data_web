import { formatPxCompact, type BoardSnapshot, type PairRow } from "@/lib/board";
import {
  markBox,
  overlapTop,
  tileFill,
  tileType,
} from "@/lib/heatmap-layout";
import { squarify } from "@/lib/squarify";

export const HEATMAP_OG_SIZE = 1200;

const PAD = 32;
const HEADER_H = 52;
const HEADER_GAP = 14;
const INK = "#f5f5f7";
const MUTED = "rgba(245, 245, 247, 0.52)";
const LINE = "rgba(255, 255, 255, 0.12)";
const WELL = "#0c0d10";
const PANEL = "#16171a";

function holdPct(row: PairRow): string {
  return `${Math.round(row.holdPct * 1000) / 10}%`;
}

export function HeatmapShareCard({ board }: { board: BoardSnapshot }) {
  const mapW = HEATMAP_OG_SIZE - PAD * 2;
  const mapH = HEATMAP_OG_SIZE - PAD - HEADER_H - HEADER_GAP - PAD;
  const scale = mapH / 560;
  const mark = markBox(mapW);
  const listed = board.listed || 200;
  const refreshed = board.capturedAt
    ? `LAST REFRESHED AT ${board.capturedAt} UTC`
    : "LAST REFRESHED —";
  const byCoin = new Map(board.rows.map((row) => [row.coin, row]));
  const tiles = squarify(
    board.rows.map((row) => ({ id: row.coin, value: row.holdPct })),
    mapW,
    mapH,
  ).flatMap((rect) => {
    const row = byCoin.get(rect.id);
    if (!row || rect.w < 2 || rect.h < 2) return [];
    const extraTop = overlapTop(rect, mark);
    return [
      {
        row,
        rect,
        extraTop,
        type: tileType(rect.w, rect.h, row.label, row.dex, extraTop, scale),
      },
    ];
  });

  return (
    <div
      style={{
        width: HEATMAP_OG_SIZE,
        height: HEATMAP_OG_SIZE,
        display: "flex",
        flexDirection: "column",
        background: PANEL,
        color: INK,
        padding: PAD,
      }}
    >
      <div
        style={{
          width: mapW,
          height: HEADER_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          HYPERLIQUID {listed} BAGRANK HEATMAP
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 15,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          REFRESH EVERY 1H
          <div
            style={{
              width: 9,
              height: 9,
              marginLeft: 8,
              marginRight: 8,
              border: "2px solid rgba(245,245,247,0.28)",
              borderTopColor: INK,
              borderRadius: 99,
            }}
          />
          {refreshed}
        </div>
      </div>
      <div
        style={{
          width: mapW,
          height: mapH,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          borderRadius: 18,
          background: WELL,
        }}
      >
        {tiles.length === 0 ? (
          <div
            style={{
              width: mapW,
              height: mapH,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: MUTED,
              fontSize: 28,
            }}
          >
            {board.error ?? "Waiting for the first snapshot."}
          </div>
        ) : (
          tiles.map(({ row, rect, extraTop, type }) => (
            <div
              key={row.coin}
              style={{
                position: "absolute",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                paddingTop: type.padY + extraTop,
                paddingRight: type.padX,
                paddingBottom: type.padY,
                paddingLeft: type.padX,
                background: tileFill(row),
                border: `1px solid ${LINE}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  fontSize: type.pair,
                  fontWeight: 700,
                  letterSpacing: -0.4,
                  lineHeight: 1.05,
                  whiteSpace: "nowrap",
                }}
              >
                {row.label}
                {row.dex ? (
                  <div
                    style={{
                      display: "flex",
                      marginLeft: 6,
                      fontSize: Math.max(8, type.pair * 0.58),
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: MUTED,
                    }}
                  >
                    {row.dex}
                  </div>
                ) : null}
              </div>
              {type.showMeta ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: type.meta,
                    opacity: 0.9,
                    marginTop: 2,
                  }}
                >
                  {row.side.toUpperCase()} {holdPct(row)}
                </div>
              ) : null}
              {type.showSub ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: type.sub,
                    color: MUTED,
                    marginTop: 2,
                  }}
                >
                  {row.wallets}/{row.onCoin} · agr {Math.round(row.agreement * 100)}%
                  {row.price ? ` · ${formatPxCompact(row.price)}` : ""} · {row.leverage}x
                </div>
              ) : null}
            </div>
          ))
        )}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 16,
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: -1,
            color: INK,
            opacity: 0.26,
          }}
        >
          bagrank.xyz
        </div>
      </div>
    </div>
  );
}
