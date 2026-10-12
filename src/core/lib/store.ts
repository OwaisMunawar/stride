/**
 * Minimal external store for useSyncExternalStore. State changes are
 * immutable replacements, so React can compare snapshots by reference.
 */
export type Store<T> = {
  get(): T;
  set(next: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const value = typeof next === 'function' ? (next as (current: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type Emitter<E> = {
  emit(event: E): void;
  on(listener: (event: E) => void): () => void;
};

export function createEmitter<E>(): Emitter<E> {
  const listeners = new Set<(event: E) => void>();
  return {
    emit(event) {
      for (const listener of [...listeners]) listener(event);
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
