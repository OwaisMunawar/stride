import { AppError } from '@/core/errors/AppError';
import { createId } from '@/core/lib/id';
import { type RunRepository } from '@/features/history/data/runRepository';
import { processTrack } from '@/features/recording/lib/processTrack';
import { type Settings } from '@/features/settings/lib/settings';
import { defaultTitle } from '@/features/tracking/lib/summarize';

import { type GpxFiles } from './data/gpxFiles';
import { gpxFileName, parseGpx, writeGpx } from './lib/gpx';

export async function exportRun(deps: { runs: RunRepository; gpx: GpxFiles }, runId: string) {
  const [run, points] = await Promise.all([deps.runs.get(runId), deps.runs.points(runId)]);
  const xml = writeGpx({
    name: run.title,
    activity: run.activity,
    startedAt: run.startedAt,
    points,
  });
  await deps.gpx.share(gpxFileName(run.title, run.startedAt), xml);
}

/**
 * Imports a GPX as a finished run, through the same filter and state machine
 * as a live recording. Returns the new run id, or null if the user cancelled.
 */
export async function importGpx(
  deps: { runs: RunRepository; gpx: GpxFiles; settings: () => Settings },
  picked?: { name: string; text: string } | null,
): Promise<string | null> {
  const file = picked === undefined ? await deps.gpx.pick() : picked;
  if (!file) return null;
  const parsed = parseGpx(file.text);
  const settings = deps.settings();
  const activity = parsed.activity ?? settings.activity;
  const processed = processTrack({
    segments: parsed.segments,
    activity,
    autoPause: settings.autoPause,
    weightKg: settings.weightKg,
  });
  if (!processed || processed.points.length < 2) {
    throw new AppError('GPX_EMPTY', 'The GPX file has no usable track points');
  }
  const id = createId();
  await deps.runs.insertFinished({
    meta: {
      id,
      title: parsed.name ?? defaultTitle(activity, processed.startedAt),
      activity,
      source: 'import',
      autoPause: settings.autoPause,
      startedAt: processed.startedAt,
    },
    endedAt: processed.endedAt,
    summary: processed.summary,
    points: processed.points,
  });
  return id;
}
