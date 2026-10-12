import { isAppError } from '@/core/errors/AppError';
import { createTestDriver } from '@/test-utils/sqliteTestDriver';

import { migrate } from '../migrate';
import { migrations, type Migration } from '../migrations';

describe('migrate', () => {
  it('applies every migration on a fresh database and records the version', async () => {
    const db = createTestDriver();
    await expect(migrate(db)).resolves.toEqual({ from: 0, to: migrations.length });
    const [row] = await db.query<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(migrations.length);
  });

  it('is a no-op when the schema is current', async () => {
    const db = createTestDriver();
    await migrate(db);
    await expect(migrate(db)).resolves.toEqual({ from: migrations.length, to: migrations.length });
  });

  it('creates the run, fix, track and insight tables', async () => {
    const db = createTestDriver();
    await migrate(db);
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'runs',
        'run_events',
        'fixes',
        'track_points',
        'settings',
        'insights',
      ]),
    );
  });

  it('rolls back a failing migration and leaves the version untouched', async () => {
    const db = createTestDriver();
    const broken: Migration[] = [
      { version: 1, name: 'ok', statements: ['CREATE TABLE a (id INTEGER)'] },
      { version: 2, name: 'broken', statements: ['CREATE TABLE b (id INTEGER)', 'NOT SQL'] },
    ];

    const error = await migrate(db, broken).catch((e: unknown) => e);
    expect(isAppError(error, 'DB_MIGRATION_FAILED')).toBe(true);

    const [row] = await db.query<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(1);
    const leftovers = await db.query("SELECT name FROM sqlite_master WHERE name = 'b'");
    expect(leftovers).toHaveLength(0);
  });

  it('rejects migrations that are out of order', async () => {
    const db = createTestDriver();
    const gap: Migration[] = [{ version: 2, name: 'skipped one', statements: [] }];
    await expect(migrate(db, gap)).rejects.toMatchObject({ code: 'DB_MIGRATION_FAILED' });
  });
});

describe('schema', () => {
  it('allows only one active run at a time', async () => {
    const db = createTestDriver();
    await migrate(db);
    const insert = (id: string) =>
      db.run(
        `INSERT INTO runs (id, status, activity, source, auto_pause, title, started_at)
         VALUES (?, 'active', 'run', 'device', 'normal', 'Run', 1)`,
        [id],
      );
    await insert('a');
    // better-sqlite3 errors can come from another realm under Jest, so match
    // on the message rather than on instanceof Error.
    const error = await insert('b').catch((e: unknown) => e);
    expect(String(error)).toMatch(/UNIQUE constraint failed/);
  });
});
