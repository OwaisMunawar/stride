import { createTestDriver } from '@/test-utils/sqliteTestDriver';

import { insertMany } from '../insertMany';

describe('insertMany', () => {
  it('splits large inserts into statements under the parameter cap', async () => {
    const db = createTestDriver();
    await db.run('CREATE TABLE t (a INTEGER, b TEXT, c REAL)');
    const run = jest.spyOn(db, 'run');
    const rows = Array.from({ length: 1000 }, (_, i) => [i, `row ${i}`, i / 2]);
    await insertMany(db, 't', ['a', 'b', 'c'], rows);
    // 900 parameters / 3 columns = 300 rows per statement.
    expect(run).toHaveBeenCalledTimes(4);
    const [count] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM t');
    expect(count?.n).toBe(1000);
    const [last] = await db.query<{ b: string }>('SELECT b FROM t WHERE a = 999');
    expect(last?.b).toBe('row 999');
  });

  it('does nothing for no rows', async () => {
    const db = createTestDriver();
    const run = jest.spyOn(db, 'run');
    await insertMany(db, 't', ['a'], []);
    expect(run).not.toHaveBeenCalled();
  });
});
