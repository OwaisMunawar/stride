import { AppError } from '@/core/errors/AppError';

import { migrations as defaultMigrations, type Migration } from './migrations';
import { type SqlDriver } from './SqlDriver';

/**
 * Brings the database to the latest schema. The version lives in
 * `PRAGMA user_version`, which SQLite stores in the file header, so there is no
 * bookkeeping table to get out of sync with the schema it describes.
 *
 * Each migration runs in its own transaction together with its version bump:
 * a crash mid-way leaves the database at the last fully applied version.
 */
export async function migrate(
  db: SqlDriver,
  migrations: readonly Migration[] = defaultMigrations,
): Promise<{ from: number; to: number }> {
  assertOrdered(migrations);
  const [row] = await db.query<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;
  let current = from;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    try {
      await db.transaction(async (tx) => {
        for (const statement of migration.statements) {
          await tx.run(statement);
        }
        // PRAGMA cannot take bound parameters; the value is a checked integer.
        await tx.run(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
      });
    } catch (cause) {
      throw new AppError(
        'DB_MIGRATION_FAILED',
        `Migration ${migration.version} (${migration.name}) failed`,
        { cause },
      );
    }
    current = migration.version;
  }

  return { from, to: current };
}

function assertOrdered(migrations: readonly Migration[]) {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new AppError(
        'DB_MIGRATION_FAILED',
        `Migrations must be numbered 1..n without gaps; found ${migration.version} at position ${index + 1}`,
      );
    }
  });
}
