/**
 * Unit tests for the W3C closeApp command (session-scoped).
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {
  assertCalled,
  assertCalledTimes,
  assertNotCalled,
  assertNthCalledWith,
  calls,
  clearCalls,
  queueResolved,
} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const HWND = 0x1234;
const OTHER_HWND = 1;

const {getAllWindowHandles} = createUser32Mock();
mockUser32(createUser32Mock({getAllWindowHandles}));
const {sleep} = await mockCommonModules();

const {closeApp} = await import('../../../lib/commands/app.js');

/** Each element is what one `getAllWindowHandles` call returns; the last one repeats. */
function listWindows(...snapshots: number[][]) {
  let call = 0;
  getAllWindowHandles.mock.mockImplementation(() => snapshots[Math.min(call++, snapshots.length - 1)]);
}

/** Makes `performance.now()` advance only through the (otherwise no-op) `sleep`. */
function useFakeClock(t: {mock: typeof mock}) {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  sleep.mock.mockImplementation(async (ms: number) => {
    now += ms;
  });
  return () => now;
}

describe('closeApp (W3C)', () => {
  beforeEach(() => {
    clearCalls(getAllWindowHandles, sleep);
    sleep.mock.mockImplementation(async () => {});
    listWindows([]);
  });

  it('closes the session app window via C# server commands', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', String(HWND), undefined, undefined);

    await closeApp.call(driver);

    assertCalledTimes(driver.sendCommand, 4);
    assertNthCalledWith(driver.sendCommand, 1, 'saveRootElementToTable', {});
    assertNthCalledWith(driver.sendCommand, 2, 'getProperty', {
      elementId: 'element-123',
      property: 'NativeWindowHandle',
    });
    assertNthCalledWith(driver.sendCommand, 3, 'closeWindow', {elementId: 'element-123'});
    assertNthCalledWith(driver.sendCommand, 4, 'setRootElementNull', {});
  });

  it('does not sleep when the window is already gone', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', String(HWND));
    listWindows([OTHER_HWND]);

    await closeApp.call(driver);

    assertCalledTimes(getAllWindowHandles, 1);
    assertNotCalled(sleep);
  });

  it('waits until the closed window is no longer listed', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', String(HWND));
    listWindows([HWND, OTHER_HWND], [HWND, OTHER_HWND], [OTHER_HWND]);

    await closeApp.call(driver);

    assertCalledTimes(getAllWindowHandles, 3);
    assertCalledTimes(sleep, 2);
    assertNotCalled(driver.log.warn);
  });

  it('accepts a hex window handle', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', '0x1234');
    listWindows([HWND], [OTHER_HWND]);

    await closeApp.call(driver);

    assertCalledTimes(getAllWindowHandles, 2);
  });

  it('gives up with a warning at the deadline, without a trailing sleep', async (t) => {
    const elapsed = useFakeClock(t);
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', String(HWND));
    listWindows([HWND]);

    await closeApp.call(driver);

    assert.equal(elapsed(), 3000);
    // One check per sleep, plus the one that finds the deadline reached.
    assert.equal(getAllWindowHandles.mock.callCount(), sleep.mock.callCount() + 1);
    assertCalledTimes(driver.log.warn, 1);
    assert.match(calls(driver.log.warn)[0][0], /0x00001234/);
  });

  for (const [label, value] of [
    ['zero', '0'],
    ['empty', ''],
    ['null', null],
    ['non-numeric', 'n/a'],
  ] as const) {
    it(`closes without waiting, and logs it, when the handle is ${label}`, async () => {
      const driver = createMockDriver() as any;
      queueResolved(driver.sendCommand, 'element-123', value);

      await closeApp.call(driver);

      assertNthCalledWith(driver.sendCommand, 3, 'closeWindow', {elementId: 'element-123'});
      assertNthCalledWith(driver.sendCommand, 4, 'setRootElementNull', {});
      assertNotCalled(getAllWindowHandles);
      assertCalled(driver.log.warn);
    });
  }

  it('still closes the window when reading its handle fails', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string) => {
      if (method === 'getProperty') {
        throw new Error('element is stale');
      }
      return 'element-123';
    });

    await closeApp.call(driver);

    assertNthCalledWith(driver.sendCommand, 3, 'closeWindow', {elementId: 'element-123'});
    assertNthCalledWith(driver.sendCommand, 4, 'setRootElementNull', {});
    assertNotCalled(getAllWindowHandles);
    assert.match(calls(driver.log.warn)[0][0], /element is stale/);
  });

  it('throws NoSuchWindowError when root element is empty string', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, '');

    await assert.rejects(closeApp.call(driver), /No active app window/);
  });

  it('throws NoSuchWindowError when root element is null', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, null);

    await assert.rejects(closeApp.call(driver), /No active app window/);
  });
});
