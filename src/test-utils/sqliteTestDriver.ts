import Database from 'better-sqlite3';

import { migrate } from '@/core/db/migrate';
import { type Row, type SqlDriver, type SqlExecutor, type SqlValue } from '@/core/db/SqlDriver';

/**
 * In-memory SQLite behind the same driver interface the app uses, so repository
 * tests run the real schema and real queries rather than mocks.
 */
export function createTestDriver(): SqlDriver {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const toParam = (value: SqlValue) => (value instanceof Uint8Array ? Buffer.from(value) : value);
  const fromValue = (value: unknown): SqlValue =>
    Buffer.isBuffer(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : typeof value === 'bigint'
        ? Number(value)
        : (value as SqlValue);

  const executor: SqlExecutor = {
    async query<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []) {
      const statement = db.prepare(sql);
      if (!statement.reader) {
        statement.run(...params.map(toParam));
        return [];
      }
      const rows = statement.all(...params.map(toParam)) as Record<string, unknown>[];
      return rows.map(
        (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, fromValue(v)])) as T,
      );
    },
    async run(sql: string, params: readonly SqlValue[] = []) {
      const result = db.prepare(sql).run(...params.map(toParam));
      return { rowsAffected: result.changes, insertId: Number(result.lastInsertRowid) };
    },
  };

  return {
    ...executor,
    async transaction(work) {
      db.exec('BEGIN');
      try {
        const result = await work(executor);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}

export async function createMigratedTestDriver(): Promise<SqlDriver> {
  const driver = createTestDriver();
  await migrate(driver);
  return driver;
}
