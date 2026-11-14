import { describe, expect, it } from 'vitest';
import { reorder } from './reorder';

describe('reorder', () => {
  it('moves an item down', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves an item up', () => {
    expect(reorder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('keeps neighbors when moving one step', () => {
    expect(reorder(['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op for same index or out-of-range indexes', () => {
    const arr = ['a', 'b'];
    expect(reorder(arr, 1, 1)).toEqual(['a', 'b']);
    expect(reorder(arr, 5, 0)).toEqual(['a', 'b']);
    expect(reorder(arr, 0, -1)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const arr = ['a', 'b'];
    reorder(arr, 0, 1);
    expect(arr).toEqual(['a', 'b']);
  });
});
