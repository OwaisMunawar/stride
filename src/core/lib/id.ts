/**
 * Sortable, collision-resistant local ids: a millisecond timestamp prefix keeps
 * inserts roughly ordered in the primary-key index, and 64 random bits make
 * collisions on one device practically impossible. Nothing is ever synced, so
 * global uniqueness guarantees (UUIDv7, ULID) would buy nothing extra.
 */
export function createId(now: number = Date.now(), random: () => number = Math.random): string {
  const time = now.toString(36).padStart(9, '0');
  let entropy = '';
  for (let i = 0; i < 4; i++) {
    entropy += Math.floor(random() * 0x10000)
      .toString(36)
      .padStart(4, '0');
  }
  return `${time}${entropy}`;
}
