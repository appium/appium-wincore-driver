/**
 * Small assertion helpers over `node:test` mock functions (`mock.fn()`).
 * Argument matching is exact (deepStrictEqual), like vitest's `toHaveBeenCalledWith`.
 */
import assert from 'node:assert/strict';

interface MockState {
  calls: {arguments: any[]}[];
  callCount(): number;
  resetCalls(): void;
  mockImplementationOnce(impl: (...args: any[]) => any, onCall?: number): void;
}

/** Any function: modules under test export real function types, but the mocked ones carry `.mock`. */
export type MockLike = (...args: any[]) => any;

function stateOf(fn: MockLike): MockState {
  const state = (fn as any).mock as MockState | undefined;
  assert.ok(state, 'expected a node:test mock function (mock.fn())');
  return state;
}

/** Argument lists of every call, in order. */
export function calls(fn: MockLike): any[][] {
  return stateOf(fn).calls.map((c) => c.arguments);
}

/** Clears call history only; implementations are kept (vitest's `clearAllMocks`). */
export function clearCalls(...fns: MockLike[]): void {
  for (const fn of fns) {
    stateOf(fn).resetCalls();
  }
}

export function assertCalled(fn: MockLike): void {
  assert.ok(stateOf(fn).callCount() > 0, 'expected mock to have been called');
}

export function assertNotCalled(fn: MockLike): void {
  assert.equal(stateOf(fn).callCount(), 0, `expected no calls, got ${JSON.stringify(calls(fn))}`);
}

export function assertCalledTimes(fn: MockLike, times: number): void {
  assert.equal(stateOf(fn).callCount(), times, `unexpected call count; calls: ${JSON.stringify(calls(fn))}`);
}

export function assertCalledWith(fn: MockLike, ...expected: any[]): void {
  const found = calls(fn).some((args) => isDeepEqual(args, expected));
  assert.ok(found, `expected a call with ${JSON.stringify(expected)}, got ${JSON.stringify(calls(fn))}`);
}

export function assertNotCalledWith(fn: MockLike, ...expected: any[]): void {
  const found = calls(fn).some((args) => isDeepEqual(args, expected));
  assert.ok(!found, `expected no call with ${JSON.stringify(expected)}`);
}

/** `n` is 1-based. */
export function assertNthCalledWith(fn: MockLike, n: number, ...expected: any[]): void {
  const actual = calls(fn)[n - 1];
  assert.ok(actual, `expected at least ${n} call(s), got ${stateOf(fn).callCount()}`);
  assert.deepEqual(actual, expected);
}

/** Queues one-shot resolved values for the next calls, in order (vitest's chained `mockResolvedValueOnce`). */
export function queueResolved(fn: MockLike, ...values: any[]): void {
  const start = stateOf(fn).callCount();
  values.forEach((value, i) => stateOf(fn).mockImplementationOnce(async () => value, start + i));
}

/** Queues one-shot rejections for the next calls, in order. */
export function queueRejected(fn: MockLike, ...errors: any[]): void {
  const start = stateOf(fn).callCount();
  errors.forEach((err, i) =>
    stateOf(fn).mockImplementationOnce(async () => {
      throw err;
    }, start + i),
  );
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}
