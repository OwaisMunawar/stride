import { createEmitter, createStore } from '../store';

describe('createStore', () => {
  it('notifies subscribers on change and supports updater functions', () => {
    const store = createStore({ count: 0 });
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.set((s) => ({ count: s.count + 1 }));
    expect(store.get()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set({ count: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('skips notifications when the state is unchanged', () => {
    const state = { a: 1 };
    const store = createStore(state);
    const listener = jest.fn();
    store.subscribe(listener);
    store.set(state);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createEmitter', () => {
  it('delivers events until unsubscribed', () => {
    const emitter = createEmitter<string>();
    const seen: string[] = [];
    const off = emitter.on((e) => seen.push(e));
    emitter.emit('a');
    off();
    emitter.emit('b');
    expect(seen).toEqual(['a']);
  });
});
