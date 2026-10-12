import { type AutoPauseSensitivity } from '@/features/tracking/lib/autoPause';
import { type RunSummary } from '@/features/tracking/lib/summarize';
import { type ActivityType } from '@/features/tracking/lib/types';

import { type Thumbnail } from './lib/thumbnail';

export type RunSource = 'device' | 'replay' | 'import' | 'demo';

export type RunMeta = {
  id: string;
  title: string;
  activity: ActivityType;
  source: RunSource;
  autoPause: AutoPauseSensitivity;
  startedAt: number;
};

/** A finished run as the history screens see it. Bounds come from the track when needed. */
export type RunRecord = RunMeta & {
  endedAt: number;
  summary: Omit<RunSummary, 'bounds'>;
  thumbnail: Thumbnail;
};
