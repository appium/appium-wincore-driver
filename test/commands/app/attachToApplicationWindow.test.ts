/**
 * Unit tests for attachToApplicationWindow / attachToWindowHandles window selection
 * when the launched process tree owns more than one top-level window.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledTimes, assertCalledWith, assertNotCalled, calls, clearCalls} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const user32 = createUser32Mock();
const mockGetWindowAllHandlesForProcessIds = user32.getWindowAllHandlesForProcessIds;
mockUser32(user32);
await mockCommonModules();

const {attachToApplicationWindow, attachToWindowHandles, changeRootElement, waitForMainWindow} =
  await import('../../../lib/commands/app.js');

const MAIN = 0x100;
const PALETTE = 0x200;

/**
 * Mock driver whose process tree owns the given windows, each with the given number of
 * keyboard-focusable descendants. Element ids are `el-<hwnd>`.
 */
function createDriver(focusablesByHandle: Record<number, number>) {
  const driver = createMockDriver() as any;
  driver.attachToWindowHandles = mock.fn(attachToWindowHandles);
  driver.focusElement = mock.fn(async () => undefined);
  let rootId = '';
  const sendImpl = async (method: string, args: any) => {
    switch (method) {
      case 'getChildProcessIds':
        return [];
      case 'elementFromHandle':
        return `el-${args.handle}`;
      case 'setRootElementFromElementId':
        rootId = args.elementId;
        return null;
      case 'checkRootElementNotNull':
        return true;
      case 'saveRootElementToTable':
        return rootId;
      case 'getProperty':
        if (args.property === 'ClassName') {
          return 'Window';
        }
        if (args.property === 'NativeWindowHandle') {
          return args.elementId.slice(3);
        }
        return null;
      case 'findElements': {
        const hwnd = Number(args.contextElementId.slice(3));
        return Array.from({length: focusablesByHandle[hwnd] ?? 0}, (_, i) => `f${i}`);
      }
      default:
        return null;
    }
  };
  driver.sendCommand.mock.mockImplementation(sendImpl);
  driver.sendImpl = sendImpl;
  return driver;
}

function rootsSet(driver: any): string[] {
  return calls(driver.sendCommand)
    .filter(([m]: [string]) => m === 'setRootElementFromElementId')
    .map(([, args]: [string, any]) => args.elementId);
}

describe('attachToApplicationWindow', () => {
  beforeEach(() => clearCalls(mockGetWindowAllHandlesForProcessIds));

  it('attaches to the window with focusable content even when an auxiliary window is last in z-order', async () => {
    // Notepad: main window on top, its empty "Command Palette" window below it.
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [MAIN, PALETTE]);
    const driver = createDriver({[MAIN]: 40, [PALETTE]: 0});

    const result = await attachToApplicationWindow.call(driver, 1234);

    assert.equal(result.focused, true);
    assert.deepEqual(rootsSet(driver), [`el-${MAIN}`]);
  });

  it('falls back to the last window and flags a splash screen when no window has focusable content', async () => {
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [MAIN, PALETTE]);
    const driver = createDriver({[MAIN]: 1, [PALETTE]: 0});

    const result = await attachToApplicationWindow.call(driver, 1234);

    assert.equal(result.focused, false);
    assert.deepEqual(rootsSet(driver), [`el-${PALETTE}`]);
  });

  it('skips the multi-window scan when the process has a single window', async () => {
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [MAIN]);
    const driver = createDriver({[MAIN]: 40});

    const result = await attachToApplicationWindow.call(driver, 1234);

    assert.equal(result.focused, true);
    assertNotCalled(driver.attachToWindowHandles);
    assert.deepEqual(rootsSet(driver), [`el-${MAIN}`]);
  });
});

describe('attachToWindowHandles', () => {
  beforeEach(() => clearCalls(mockGetWindowAllHandlesForProcessIds));

  it('falls back to the first valid window when none has focusable content', async () => {
    const driver = createDriver({[MAIN]: 0, [PALETTE]: 0});

    assert.equal(await attachToWindowHandles.call(driver, [MAIN, PALETTE]), true);
    assert.deepEqual(rootsSet(driver), [`el-${MAIN}`]);
  });

  it('with requireFocusable, returns false and leaves the root alone when none has focusable content', async () => {
    const driver = createDriver({[MAIN]: 0, [PALETTE]: 0});

    assert.equal(await attachToWindowHandles.call(driver, [MAIN, PALETTE], {requireFocusable: true}), false);
    assert.deepEqual(rootsSet(driver), []);
  });
});

describe('waitForMainWindow', () => {
  beforeEach(() => clearCalls(mockGetWindowAllHandlesForProcessIds));

  it('attaches to a window that gains focusable content while the splash is still open', async () => {
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [MAIN, PALETTE]);
    const focusables: Record<number, number> = {[MAIN]: 0, [PALETTE]: 0};
    const driver = createDriver(focusables);
    driver.attachToApplicationWindow = mock.fn();
    await driver.sendCommand('setRootElementFromElementId', {elementId: `el-${PALETTE}`});
    // Main window's UIA tree finishes loading after the first poll.
    driver.attachToWindowHandles.mock.mockImplementationOnce(async function (this: any, ...args: any[]) {
      const attached = await attachToWindowHandles.apply(this, args as any);
      focusables[MAIN] = 40;
      return attached;
    }, driver.attachToWindowHandles.mock.callCount());

    await waitForMainWindow.call(driver, [1234], performance.now() + 5_000);

    assert.equal(rootsSet(driver).at(-1), `el-${MAIN}`);
    assertCalledTimes(driver.attachToWindowHandles, 2);
    assertNotCalled(driver.attachToApplicationWindow);
  });

  it('re-attaches via attachToApplicationWindow once the splash closes', async () => {
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [PALETTE]);
    const driver = createDriver({[PALETTE]: 0});
    driver.attachToApplicationWindow = mock.fn(async () => ({focused: true, knownPids: [1234]}));
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) =>
      method === 'checkRootElementNotNull' ? false : driver.sendImpl(method, args),
    );

    await waitForMainWindow.call(driver, [1234], performance.now() + 5_000);

    assertCalledWith(driver.sendCommand, 'setRootElementNull', {});
    const attachCall = calls(driver.attachToApplicationWindow).find(([pid]) => pid === 1234);
    assert.ok(attachCall);
    assert.notEqual(attachCall[1], undefined);
  });

  it('gives up at the deadline and stays on the splash when nothing qualifies', async () => {
    mockGetWindowAllHandlesForProcessIds.mock.mockImplementation(() => [PALETTE]);
    const driver = createDriver({[PALETTE]: 0});
    driver.attachToApplicationWindow = mock.fn();
    await driver.sendCommand('setRootElementFromElementId', {elementId: `el-${PALETTE}`});

    await waitForMainWindow.call(driver, [1234], performance.now() + 500);

    assert.deepEqual(rootsSet(driver), [`el-${PALETTE}`]);
    assert.ok(calls(driver.log.warn).some(([msg]) => String(msg).includes('Deadline reached')));
  });
});

describe('changeRootElement splash handling', () => {
  beforeEach(() => {
    clearCalls(mockGetWindowAllHandlesForProcessIds);
  });

  function createLaunchDriver(caps: Record<string, unknown>) {
    const driver = createMockDriver() as any;
    driver.caps = caps;
    driver.sendCommand.mock.mockImplementation(async (method: string) => (method === 'startProcess' ? 1234 : null));
    driver.attachToApplicationWindow = mock.fn(async () => ({focused: false, knownPids: [1234, 5678]}));
    driver.waitForMainWindow = mock.fn(async () => undefined);
    return driver;
  }

  it('waits for the main window with a default deadline when ms:waitForAppLaunch is unset', async () => {
    const driver = createLaunchDriver({});
    const before = performance.now();

    await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

    assertCalledTimes(driver.waitForMainWindow, 1);
    const [pids, deadline] = calls(driver.waitForMainWindow)[0];
    assert.deepEqual(pids, [1234, 5678]);
    assert.ok(deadline > before);
    assert.ok(deadline <= performance.now() + 5_000);
  });

  it('uses ms:waitForAppLaunch as the splash deadline when set', async () => {
    const driver = createLaunchDriver({'ms:waitForAppLaunch': 30});
    const before = performance.now();

    await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

    const [, deadline] = calls(driver.waitForMainWindow)[0];
    assert.ok(deadline > before + 20_000);
  });

  it('does not wait when the attached window is not a splash', async () => {
    const driver = createLaunchDriver({});
    driver.attachToApplicationWindow.mock.mockImplementation(async () => ({focused: true, knownPids: [1234]}));

    await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

    assertNotCalled(driver.waitForMainWindow);
  });
});
