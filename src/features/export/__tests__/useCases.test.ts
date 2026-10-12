import { isAppError } from '@/core/errors/AppError';
import { createEmitter } from '@/core/lib/store';
import { createRunRepository } from '@/features/history/data/runRepository';
import { defaultSettings } from '@/features/settings/lib/settings';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';
import { straightFixes, toPoints } from '@/test-utils/tracks';

import { type GpxFiles } from '../data/gpxFiles';
import { parseGpx, writeGpx } from '../lib/gpx';
import { exportRun, importGpx } from '../useCases';

async function setup() {
  const db = await createMigratedTestDriver();
  const runs = createRunRepository(db, createEmitter<void>());
  const shared: { name: string; gpx: string }[] = [];
  const gpx: GpxFiles = {
    share: async (name, xml) => void shared.push({ name, gpx: xml }),
    pick: async () => null,
  };
  return { runs, gpx, shared, settings: () => defaultSettings };
}

const sampleGpx = writeGpx({
  name: 'Track from a watch',
  activity: 'run',
  startedAt: Date.UTC(2026, 8, 1, 6),
  points: toPoints(straightFixes({ speedMps: 3, seconds: 900, startT: Date.UTC(2026, 8, 1, 6) })),
});

describe('import and export', () => {
  it('imports a GPX through the recording pipeline and exports it again', async () => {
    const env = await setup();
    const id = await importGpx(env, { name: 'watch.gpx', text: sampleGpx });
    const run = await env.runs.get(id!);
    expect(run).toMatchObject({ title: 'Track from a watch', source: 'import', activity: 'run' });
    expect(run.summary.distanceM).toBeCloseTo(2700, -2);

    await exportRun(env, id!);
    expect(env.shared[0]!.name).toBe('2026-09-01-track-from-a-watch.gpx');
    const reparsed = parseGpx(env.shared[0]!.gpx);
    expect(reparsed.segments.flat().length).toBe((await env.runs.points(id!)).length);
  });

  it('returns null when the picker is cancelled and rejects unusable files', async () => {
    const env = await setup();
    expect(await importGpx(env)).toBeNull();
    const single = '<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>';
    const error = await importGpx(env, { name: 'x.gpx', text: single }).catch((e: unknown) => e);
    expect(isAppError(error, 'GPX_EMPTY')).toBe(true);
  });

  it('names untitled imports by time of day and keeps the chosen activity', async () => {
    const env = await setup();
    const untitled = sampleGpx
      .replace(/<name>[^<]*<\/name>/g, '')
      .replace(/<type>[^<]*<\/type>/, '');
    const id = await importGpx(
      { ...env, settings: () => ({ ...defaultSettings, activity: 'ride' }) },
      {
        name: 'x.gpx',
        text: untitled,
      },
    );
    const run = await env.runs.get(id!);
    expect(run.activity).toBe('ride');
    expect(run.title).toMatch(/Ride$/);
  });
});
