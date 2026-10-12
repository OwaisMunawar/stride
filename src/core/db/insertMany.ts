import { type SqlExecutor, type SqlValue } from './SqlDriver';

/**
 * SQLite caps bound parameters per statement (999 on older builds). Batching
 * rows into multi-row VALUES under that cap turns thousands of round trips
 * into a few dozen when a finished run writes its track.
 */
const MAX_PARAMS = 900;

export async function insertMany(
  executor: SqlExecutor,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly SqlValue[])[],
): Promise<void> {
  if (rows.length === 0) return;
  const perRow = columns.length;
  const chunkSize = Math.max(1, Math.floor(MAX_PARAMS / perRow));
  const placeholder = `(${columns.map(() => '?').join(', ')})`;

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk
      .map(() => placeholder)
      .join(', ')}`;
    await executor.run(sql, chunk.flat());
  }
}
