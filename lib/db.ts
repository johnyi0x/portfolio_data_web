import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

let sql: Sql | null = null;

export function databaseUrl(): string {
  return (
    process.env.BAGINDEX_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

export function getSql(): Sql | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!sql) sql = neon(url);
  return sql;
}
