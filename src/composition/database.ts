import { openExpoSqliteDriver } from '@/core/db/expoSqliteDriver';
import { migrate } from '@/core/db/migrate';
import { type SqlDriver } from '@/core/db/SqlDriver';

let opening: Promise<SqlDriver> | null = null;

/**
 * The one connection for the process, shared by the UI and the background
 * location task. Memoised at the composition root (not in any feature) because
 * the OS may start the task before React has mounted anything, and both paths
 * must end up writing through the same serialised queue.
 */
export function openAppDatabase(): Promise<SqlDriver> {
  opening ??= (async () => {
    const db = await openExpoSqliteDriver('stride.db');
    await migrate(db);
    return db;
  })().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}
