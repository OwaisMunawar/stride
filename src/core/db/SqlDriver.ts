/**
 * The smallest surface the repositories need from SQLite. op-sqlite backs it
 * in the app; better-sqlite3 (with the same sqlite-vec extension) backs it in
 * Jest, so repository tests run real SQL instead of mocks.
 */
export type SqlValue = string | number | null | Uint8Array;

export type Row = Record<string, SqlValue>;

export type RunResult = { rowsAffected: number; insertId?: number };

export interface SqlExecutor {
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
}

export interface SqlDriver extends SqlExecutor {
  /** Runs `work` atomically. Throwing inside rolls everything back. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): void;
}
