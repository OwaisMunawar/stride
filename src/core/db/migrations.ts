export type Migration = {
  version: number;
  name: string;
  statements: readonly string[];
};

/**
 * Append-only. A shipped migration is never edited; fixes go in a new one.
 *
 * Units are SI throughout (metres, milliseconds, epoch ms); display units are
 * a settings concern and never touch stored data.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'runs, raw fixes and track points',
    statements: [
      `CREATE TABLE runs (
        id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
        activity TEXT NOT NULL CHECK (activity IN ('run', 'ride')),
        source TEXT NOT NULL CHECK (source IN ('device', 'replay', 'import', 'demo')),
        auto_pause TEXT NOT NULL CHECK (auto_pause IN ('off', 'low', 'normal', 'high')),
        title TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        distance_m REAL,
        moving_ms INTEGER,
        elapsed_ms INTEGER,
        elevation_gain_m REAL,
        elevation_loss_m REAL,
        calories REAL,
        max_speed_mps REAL,
        thumbnail TEXT
      )`,
      // At most one recording at a time, enforced by the database rather than
      // by hoping the UI never double-starts.
      `CREATE UNIQUE INDEX runs_single_active ON runs (status) WHERE status = 'active'`,
      `CREATE INDEX runs_finished_by_date ON runs (started_at DESC) WHERE status = 'finished'`,
      `CREATE TABLE run_events (
        run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
        at INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('start', 'pause', 'resume', 'stop'))
      )`,
      `CREATE INDEX run_events_by_run ON run_events (run_id, at)`,
      // Raw fixes exactly as the location source delivered them. Written by the
      // background task, folded by the engine, deleted once the run is finished.
      `CREATE TABLE fixes (
        run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
        t INTEGER NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        alt REAL,
        accuracy REAL,
        altitude_accuracy REAL,
        speed REAL
      )`,
      `CREATE INDEX fixes_by_run ON fixes (run_id)`,
      `CREATE TABLE track_points (
        run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        t INTEGER NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        alt REAL,
        segment INTEGER NOT NULL,
        PRIMARY KEY (run_id, seq)
      ) WITHOUT ROWID`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    name: 'coach insights',
    statements: [
      `CREATE TABLE insights (
        run_id TEXT PRIMARY KEY NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ],
  },
];
