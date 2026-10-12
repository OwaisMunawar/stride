import { insertMany } from '@/core/db/insertMany';
import { type SqlDriver } from '@/core/db/SqlDriver';
import { AppError } from '@/core/errors/AppError';
import { type Emitter } from '@/core/lib/store';
import {
  insertRunRow,
  toRunMeta,
  writeFinishedRun,
  type RunRow,
} from '@/features/history/data/runRows';
import { type RunMeta } from '@/features/history/model';
import { type RunSummary } from '@/features/tracking/lib/summarize';
import { type Fix, type TrackPoint } from '@/features/tracking/lib/types';

import { type Command } from '../lib/session';

export type StoredFix = Fix & { seq: number };

type FixRow = {
  seq: number;
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
  accuracy: number | null;
  altitude_accuracy: number | null;
  speed: number | null;
};

export type SessionRepository = ReturnType<typeof createSessionRepository>;

/**
 * Storage for the run being recorded. The background task only ever calls
 * `activeRunId` and `appendFixes`; everything else is the engine's.
 */
export function createSessionRepository(db: SqlDriver, runsChanged: Emitter<void>) {
  return {
    async begin(meta: RunMeta): Promise<void> {
      try {
        await db.transaction(async (tx) => {
          await insertRunRow(tx, meta, 'active');
          await tx.run('INSERT INTO run_events (run_id, at, type) VALUES (?, ?, ?)', [
            meta.id,
            meta.startedAt,
            'start',
          ]);
        });
      } catch (cause) {
        // The partial unique index is what actually prevents two recordings.
        throw new AppError('RECORDING_ALREADY_ACTIVE', 'A recording is already in progress', {
          cause,
        });
      }
    },

    async active(): Promise<RunMeta | null> {
      const [row] = await db.query<RunRow>(
        `SELECT id, title, activity, source, auto_pause, started_at FROM runs WHERE status = 'active'`,
      );
      return row ? toRunMeta(row) : null;
    },

    async activeRunId(): Promise<string | null> {
      const [row] = await db.query<{ id: string }>("SELECT id FROM runs WHERE status = 'active'");
      return row?.id ?? null;
    },

    async appendEvent(runId: string, command: Command, at: number): Promise<void> {
      await db.run('INSERT INTO run_events (run_id, at, type) VALUES (?, ?, ?)', [
        runId,
        at,
        command,
      ]);
    },

    async events(runId: string): Promise<{ command: Command; at: number }[]> {
      const rows = await db.query<{ type: Command; at: number }>(
        'SELECT type, at FROM run_events WHERE run_id = ? ORDER BY at, rowid',
        [runId],
      );
      return rows.map((row) => ({ command: row.type, at: row.at }));
    },

    async appendFixes(runId: string, fixes: readonly Fix[]): Promise<void> {
      if (fixes.length === 0) return;
      await db.transaction((tx) =>
        insertMany(
          tx,
          'fixes',
          ['run_id', 't', 'lat', 'lon', 'alt', 'accuracy', 'altitude_accuracy', 'speed'],
          fixes.map((f) => [
            runId,
            f.t,
            f.lat,
            f.lon,
            f.alt,
            f.accuracy,
            f.altitudeAccuracy,
            f.speed,
          ]),
        ),
      );
    },

    /** Fixes in arrival order after a cursor, so the engine folds each one exactly once. */
    async fixesAfter(runId: string, seq: number): Promise<StoredFix[]> {
      const rows = await db.query<FixRow>(
        `SELECT rowid AS seq, t, lat, lon, alt, accuracy, altitude_accuracy, speed
         FROM fixes WHERE run_id = ? AND rowid > ? ORDER BY rowid`,
        [runId, seq],
      );
      return rows.map((r) => ({
        seq: r.seq,
        t: r.t,
        lat: r.lat,
        lon: r.lon,
        alt: r.alt,
        accuracy: r.accuracy,
        altitudeAccuracy: r.altitude_accuracy,
        speed: r.speed,
      }));
    },

    /**
     * Turns the active run into a finished one in a single transaction. Raw
     * fixes are dropped afterwards: the filtered track is what history, export
     * and the coach use, and keeping both would double storage for nothing.
     */
    async complete(input: {
      id: string;
      endedAt: number;
      summary: RunSummary;
      points: readonly TrackPoint[];
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await writeFinishedRun(tx, input);
        await tx.run('DELETE FROM fixes WHERE run_id = ?', [input.id]);
      });
      runsChanged.emit();
    },

    async discard(runId: string): Promise<void> {
      await db.run('DELETE FROM runs WHERE id = ?', [runId]);
    },
  };
}
