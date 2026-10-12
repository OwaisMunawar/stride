import { z } from 'zod';

import { type SqlDriver } from '@/core/db/SqlDriver';

import { insightSchema, type RunInsight } from '../Coach';

const storedSchema = insightSchema.extend({
  provider: z.enum(['rules', 'onDevice', 'server']),
  generatedAt: z.number(),
  fallbackReason: z.string().optional(),
});

export type InsightRepository = ReturnType<typeof createInsightRepository>;

export function createInsightRepository(db: SqlDriver) {
  return {
    async get(runId: string): Promise<RunInsight | null> {
      const [row] = await db.query<{ payload: string }>(
        'SELECT payload FROM insights WHERE run_id = ?',
        [runId],
      );
      if (!row) return null;
      try {
        const parsed = storedSchema.safeParse(JSON.parse(row.payload));
        // An insight stored by an older schema is regenerated, not shown half-broken.
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    async save(runId: string, insight: RunInsight): Promise<void> {
      await db.run(
        `INSERT INTO insights (run_id, provider, payload, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (run_id) DO UPDATE SET provider = excluded.provider,
           payload = excluded.payload, created_at = excluded.created_at`,
        [runId, insight.provider, JSON.stringify(insight), insight.generatedAt],
      );
    },
  };
}
