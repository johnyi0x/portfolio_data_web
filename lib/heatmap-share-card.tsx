import { formatPxCompact, type BoardSnapshot, type PairRow } from "@/lib/board";
import {
  markBox,
  overlapTop,
  tileFill,
  tileType,
} from "@/lib/heatmap-layout";
import { squarify } from "@/lib/squarify";

/** X summary_large_image slot. Square cards get center-cropped. */
export const HEATMAP_OG_WIDTH = 1200;
export const HEATMAP_OG_HEIGHT = 628;

const PAD = 22;
const HEADER_H = 40;
const HEADER_GAP = 8;
const INK = "#f5f5f7";
const MUTED = "rgba(245, 245, 247, 0.52)";
const LINE = "rgba(255, 255, 255, 0.12)";
const WELL = "#0c0d10";
const PANEL = "#16171a";

function holdPct(row: PairRow): string {
  return `${Math.round(row.holdPct * 1000) / 10}%`;
}

export function HeatmapShareCard({ board }: { board: BoardSnapshot }) {
  const mapW = HEATMAP_OG_WIDTH - PAD * 2;
  const mapH = HEATMAP_OG_HEIGHT - PAD - HEADER_H - HEADER_GAP - PAD;
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
        width: HEATMAP_OG_WIDTH,
        height: HEATMAP_OG_HEIGHT,
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
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 1.2,
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
            fontSize: 13,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          REFRESH EVERY 1H
          <div
            style={{
              width: 8,
              height: 8,
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
          borderRadius: 14,
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
              fontSize: 22,
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
            top: 8,
            right: 14,
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: -0.8,
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
