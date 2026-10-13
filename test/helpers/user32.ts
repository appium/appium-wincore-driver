/**
 * Full-surface stub of `lib/winapi/user32.ts` for `mock.module()`.
 * ESM linking requires every named export the importers use, and the real module
 * can't load off-Windows (koffi `user32.dll`), so the stub lists them all.
 */
import {mock} from 'node:test';

type AnyFn = (...args: any[]) => any;

export function createUser32Mock<T extends Record<string, AnyFn> = {}>(overrides?: T) {
  return {
    isExtendedKeyVk: mock.fn(() => false),
    getResolutionScalingFactor: mock.fn(() => 1),
    keyDown: mock.fn(),
    keyUp: mock.fn(),
    sendsAsUnicodePacket: mock.fn(() => false),
    typeKey: mock.fn(),
    isNumLockOn: mock.fn(() => false),
    setNumLockState: mock.fn(),
    mouseMoveRelative: mock.fn(async (..._args: any[]) => {}),
    mouseScroll: mock.fn(),
    mouseMoveAbsolute: mock.fn(async (..._args: any[]) => {}),
    getCursorPos: mock.fn((): {x: number; y: number} | null => ({x: 0, y: 0})),
    mouseDown: mock.fn(),
    mouseUp: mock.fn(),
    getDisplayOrientation: mock.fn(() => 'LANDSCAPE'),
    getWindowThreadProcessId: mock.fn(() => 0),
    getWindowTitle: mock.fn(() => ''),
    getWindowClassName: mock.fn(() => ''),
    isIEWindowHwnd: mock.fn(() => false),
    getWindowAllHandlesForProcessIds: mock.fn((): number[] => []),
    getAllWindowHandles: mock.fn((): number[] => []),
    getVisibleWindowsWithTitles: mock.fn((): {handle: number; title: string}[] => []),
    getAllWindowsWithDetails: mock.fn((): {handle: string; title: string; className: string}[] => []),
    trySetForegroundWindow: mock.fn(async (..._args: any[]) => true),
    sendKeyboardEvents: mock.fn(() => 0),
    ...overrides,
  };
}

/** Registers the stub for `lib/winapi/user32.js`. Call before importing the code under test. */
export function mockUser32(user32: ReturnType<typeof createUser32Mock>) {
  return mock.module(new URL('../../lib/winapi/user32.js', import.meta.url).href, {exports: user32});
}
