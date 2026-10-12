import { insertMany } from '@/core/db/insertMany';
import { type SqlExecutor } from '@/core/db/SqlDriver';
import { type RunSummary } from '@/features/tracking/lib/summarize';
import { type TrackPoint } from '@/features/tracking/lib/types';

import { buildThumbnail, type Thumbnail } from '../lib/thumbnail';
import { type RunMeta, type RunRecord } from '../model';

/**
 * Row mapping and the one write path for finished runs, shared by the
 * recording flow (finishing a live session) and by imports and demo seeding.
 */
export type RunRow = {
  id: string;
  title: string;
  activity: string;
  source: string;
  auto_pause: string;
  started_at: number;
  ended_at: number | null;
  distance_m: number | null;
  moving_ms: number | null;
  elapsed_ms: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  calories: number | null;
  max_speed_mps: number | null;
  avg_pace: number | null;
  thumbnail: string | null;
};

export const RUN_COLUMNS = `id, title, activity, source, auto_pause, started_at, ended_at,
  distance_m, moving_ms, elapsed_ms, elevation_gain_m, elevation_loss_m, calories,
  max_speed_mps, CASE WHEN distance_m > 0 THEN moving_ms / distance_m END AS avg_pace, thumbnail`;

export function toRunMeta(row: RunRow): RunMeta {
  return {
    id: row.id,
    title: row.title,
    activity: row.activity === 'ride' ? 'ride' : 'run',
    source: row.source as RunMeta['source'],
    autoPause: row.auto_pause as RunMeta['autoPause'],
    startedAt: row.started_at,
  };
}

export function toRunRecord(row: RunRow): RunRecord {
  return {
    ...toRunMeta(row),
    endedAt: row.ended_at ?? row.started_at,
    summary: {
      distanceM: row.distance_m ?? 0,
      movingMs: row.moving_ms ?? 0,
      elapsedMs: row.elapsed_ms ?? 0,
      elevationGainM: row.elevation_gain_m ?? 0,
      elevationLossM: row.elevation_loss_m ?? 0,
      avgPaceSecPerKm: row.avg_pace,
      maxSpeedMps: row.max_speed_mps ?? 0,
      calories: row.calories ?? 0,
    },
    thumbnail: parseThumbnail(row.thumbnail),
  };
}

function parseThumbnail(raw: string | null): Thumbnail {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Thumbnail) : [];
  } catch {
    return [];
  }
}

/** Writes summary columns and the track for a run row that already exists. */
export async function writeFinishedRun(
  tx: SqlExecutor,
  input: { id: string; endedAt: number; summary: RunSummary; points: readonly TrackPoint[] },
): Promise<void> {
  const { id, endedAt, summary, points } = input;
  await tx.run(
    `UPDATE runs SET status = 'finished', ended_at = ?, distance_m = ?, moving_ms = ?,
       elapsed_ms = ?, elevation_gain_m = ?, elevation_loss_m = ?, calories = ?,
       max_speed_mps = ?, thumbnail = ?
     WHERE id = ?`,
    [
      endedAt,
      summary.distanceM,
      Math.round(summary.movingMs),
      Math.round(summary.elapsedMs),
      summary.elevationGainM,
      summary.elevationLossM,
      summary.calories,
      summary.maxSpeedMps,
      JSON.stringify(buildThumbnail(points)),
      id,
    ],
  );
  await tx.run('DELETE FROM track_points WHERE run_id = ?', [id]);
  await insertMany(
    tx,
    'track_points',
    ['run_id', 'seq', 't', 'lat', 'lon', 'alt', 'segment'],
    points.map((p, seq) => [id, seq, p.t, p.lat, p.lon, p.alt, p.segment]),
  );
}

export async function insertRunRow(
  tx: SqlExecutor,
  meta: RunMeta,
  status: 'active' | 'finished',
): Promise<void> {
  await tx.run(
    `INSERT INTO runs (id, status, activity, source, auto_pause, title, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [meta.id, status, meta.activity, meta.source, meta.autoPause, meta.title, meta.startedAt],
  );
}
