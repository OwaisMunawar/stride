import { AppError } from '@/core/errors/AppError';
import { type SqlDriver } from '@/core/db/SqlDriver';
import { type Emitter } from '@/core/lib/store';
import { type RunSummary } from '@/features/tracking/lib/summarize';
import { type TrackPoint } from '@/features/tracking/lib/types';

import { type RunMeta, type RunRecord } from '../model';
import { insertRunRow, RUN_COLUMNS, toRunRecord, writeFinishedRun, type RunRow } from './runRows';

export type RunRepository = ReturnType<typeof createRunRepository>;

export function createRunRepository(db: SqlDriver, changes: Emitter<void>) {
  return {
    async list(): Promise<RunRecord[]> {
      const rows = await db.query<RunRow>(
        `SELECT ${RUN_COLUMNS} FROM runs WHERE status = 'finished' ORDER BY started_at DESC`,
      );
      return rows.map(toRunRecord);
    },

    async get(id: string): Promise<RunRecord> {
      const [row] = await db.query<RunRow>(
        `SELECT ${RUN_COLUMNS} FROM runs WHERE id = ? AND status = 'finished'`,
        [id],
      );
      if (!row) throw new AppError('RUN_NOT_FOUND', `No finished run ${id}`);
      return toRunRecord(row);
    },

    async points(id: string): Promise<TrackPoint[]> {
      return db.query<TrackPoint>(
        'SELECT t, lat, lon, alt, segment FROM track_points WHERE run_id = ? ORDER BY seq',
        [id],
      );
    },

    /** Imports and demo seeding: a run that never went through a live session. */
    async insertFinished(input: {
      meta: RunMeta;
      endedAt: number;
      summary: RunSummary;
      points: readonly TrackPoint[];
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await insertRunRow(tx, input.meta, 'finished');
        await writeFinishedRun(tx, { id: input.meta.id, ...input });
      });
      changes.emit();
    },

    async rename(id: string, title: string): Promise<void> {
      await db.run('UPDATE runs SET title = ? WHERE id = ?', [title.trim() || 'Untitled', id]);
      changes.emit();
    },

    async remove(id: string): Promise<void> {
      await db.run('DELETE FROM runs WHERE id = ?', [id]);
      changes.emit();
    },

    async count(): Promise<number> {
      const [row] = await db.query<{ n: number }>(
        "SELECT COUNT(*) AS n FROM runs WHERE status = 'finished'",
      );
      return row?.n ?? 0;
    },

    subscribe(listener: () => void): () => void {
      return changes.on(listener);
    },
  };
}
