import { type SqlDriver } from '@/core/db/SqlDriver';
import { createStore, type Store } from '@/core/lib/store';

import { parseSettings, type SettingKey, type Settings } from '../lib/settings';

export type SettingsRepository = {
  store: Store<Settings>;
  set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
};

/**
 * Settings live in SQLite next to the runs (one place to back up, one place to
 * wipe) and are mirrored in a store so every screen re-renders on change. The
 * store is updated first: toggles feel instant and the write follows.
 */
export async function createSettingsRepository(db: SqlDriver): Promise<SettingsRepository> {
  const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const entries: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      entries[row.key] = JSON.parse(row.value);
    } catch {
      // A corrupt value falls back to its default via the schema.
    }
  }
  const store = createStore(parseSettings(entries));

  return {
    store,
    async set(key, value) {
      store.set((current) => ({ ...current, [key]: value }));
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value)],
      );
    },
  };
}
