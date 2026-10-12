import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { defaultSettings, parseSettings } from '../../lib/settings';
import { createSettingsRepository } from '../settingsRepository';

describe('settings', () => {
  it('falls back per key, never for the whole object', () => {
    expect(parseSettings({})).toEqual(defaultSettings);
    expect(parseSettings({ units: 'imperial', autoPause: 'sometimes', weightKg: 9000 })).toEqual({
      ...defaultSettings,
      units: 'imperial',
    });
  });

  it('persists changes and reloads them', async () => {
    const db = await createMigratedTestDriver();
    const first = await createSettingsRepository(db);
    const listener = jest.fn();
    first.store.subscribe(listener);
    await first.set('units', 'imperial');
    await first.set('weightKg', 64);
    await first.set('units', 'metric');
    expect(listener).toHaveBeenCalledTimes(3);

    await db.run("INSERT INTO settings (key, value) VALUES ('coach', '{broken')");
    const second = await createSettingsRepository(db);
    expect(second.store.get()).toEqual({ ...defaultSettings, units: 'metric', weightKg: 64 });
  });
});
