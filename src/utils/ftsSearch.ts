export interface FtsQueryable {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
  };
}

export function sanitizeFtsQuery(query: string): string {
  return query
    .trim()
    .replace(/["'*():^]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}*`)
    .join(' ');
}

export function ensureFtsTable(
  db: FtsQueryable,
  sourceTable: string,
  columns: string[]
): boolean {
  const ftsTable = `${sourceTable}_fts`;
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS "${ftsTable}" USING fts5(${columns.join(
        ', '
      )}, content='${sourceTable}', content_rowid='rowid');`
    );
    db.exec(`INSERT INTO "${ftsTable}"("${ftsTable}") VALUES('rebuild');`);
    return true;
  } catch {
    return false;
  }
}

export function searchWithFts(
  db: FtsQueryable,
  sourceTable: string,
  columns: string[],
  query: string,
  limit = 25
): Record<string, unknown>[] {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) {
    return [];
  }

  const ftsTable = `${sourceTable}_fts`;
  try {
    return db
      .prepare(
        `SELECT * FROM "${ftsTable}" WHERE "${ftsTable}" MATCH ? LIMIT ?`
      )
      .all(ftsQuery, limit) as Record<string, unknown>[];
  } catch {
    const like = `%${query.trim()}%`;
    const where = columns.map((c) => `"${c}" LIKE ?`).join(' OR ');
    const params = columns.map(() => like);
    return db
      .prepare(`SELECT * FROM "${sourceTable}" WHERE ${where} LIMIT ?`)
      .all(...params, limit) as Record<string, unknown>[];
  }
}
