import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { type Row, type SqlDriver, type SqlExecutor, type SqlValue } from './SqlDriver';

/**
 * expo-sqlite behind the driver interface.
 *
 * Every statement goes through one queue. The background location task and
 * the UI share this connection, and SQLite transactions are per connection:
 * without the queue, a fix insert from the task could land inside the UI's
 * "finish run" transaction and be rolled back with it. Serialising is cheap
 * at our volumes (one batch of fixes per second) and removes that whole class
 * of bug, where a second connection would trade it for SQLITE_BUSY handling.
 */
export async function openExpoSqliteDriver(name: string): Promise<SqlDriver> {
  const db = await openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return createDriver(db);
}

function createDriver(db: SQLiteDatabase): SqlDriver {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work, work);
    tail = result.catch(() => undefined);
    return result;
  };

  const direct: SqlExecutor = {
    query: <T extends Row = Row>(sql: string, params: readonly SqlValue[] = []) =>
      db.getAllAsync<T>(sql, [...params]),
    run: async (sql: string, params: readonly SqlValue[] = []) => {
      const result = await db.runAsync(sql, [...params]);
      return { rowsAffected: result.changes, insertId: result.lastInsertRowId };
    },
  };

  return {
    query: (sql, params) => enqueue(() => direct.query(sql, params)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    transaction: (work) =>
      enqueue(async () => {
        await db.execAsync('BEGIN IMMEDIATE');
        try {
          const result = await work(direct);
          await db.execAsync('COMMIT');
          return result;
        } catch (error) {
          await db.execAsync('ROLLBACK');
          throw error;
        }
      }),
    close: () => db.closeSync(),
  };
}
