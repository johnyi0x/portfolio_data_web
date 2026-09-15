import { neon } from "@neondatabase/serverless";
import { type Ranker } from "@/lib/ranker";

type Sql = ReturnType<typeof neon>;

const clients = new Map<Ranker, Sql>();

/** PnL Neon (site default). ROI uses ROI-specific or legacy single URL. */
export function databaseUrl(ranker: Ranker): string {
  if (ranker === "pnl") {
    return (
      process.env.BAGINDEX_DATABASE_URL_PNL?.trim() ||
      process.env.DATABASE_URL_PNL?.trim() ||
      ""
    );
  }
  return (
    process.env.BAGINDEX_DATABASE_URL_ROI?.trim() ||
    process.env.DATABASE_URL_ROI?.trim() ||
    process.env.BAGINDEX_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

export function getSql(ranker: Ranker): Sql | null {
  const url = databaseUrl(ranker);
  if (!url) return null;
  let sql = clients.get(ranker);
  if (!sql) {
    sql = neon(url);
    clients.set(ranker, sql);
  }
  return sql;
}

export function missingDbMessage(ranker: Ranker): string {
  if (ranker === "pnl") {
    return "PnL Neon URL is not set (BAGINDEX_DATABASE_URL_PNL or DATABASE_URL_PNL)";
  }
  return "ROI Neon URL is not set (BAGINDEX_DATABASE_URL_ROI, DATABASE_URL_ROI, or legacy DATABASE_URL)";
}
