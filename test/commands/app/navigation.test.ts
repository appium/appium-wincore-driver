/**
 * Unit tests for lib/commands/app.ts: back, forward, getTitle, setWindowRect
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';

import {Key} from '../../../lib/enums.js';
import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {
  assertCalledTimes,
  assertCalledWith,
  assertNthCalledWith,
  calls,
  clearCalls,
  queueResolved,
} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const user32 = createUser32Mock();
const {keyDown, keyUp} = user32;
mockUser32(user32);
await mockCommonModules();

const {back, forward, title, setWindowRect} = await import('../../../lib/commands/app.js');

const ELEMENT_ID = '1.2.3.4.5';

const assertNoCallTo = (fn: any, method: string) =>
  assert.ok(!calls(fn).some(([m]) => m === method), `unexpected call to ${method}`);

describe('back', () => {
  beforeEach(() => clearCalls(keyDown, keyUp));

  it('sends Alt+Left when a window is active', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ELEMENT_ID);

    await back.call(driver);

    assertNthCalledWith(keyDown, 1, Key.ALT);
    assertNthCalledWith(keyDown, 2, Key.LEFT);
    assertNthCalledWith(keyUp, 1, Key.LEFT);
    assertNthCalledWith(keyUp, 2, Key.ALT);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');

    await assert.rejects(back.call(driver), /No active window found/);
  });

  it('performs exactly one sendCommand call (window check) before sending keys', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ELEMENT_ID);

    await back.call(driver);

    assertCalledTimes(driver.sendCommand, 1);
    assertCalledWith(driver.sendCommand, 'saveRootElementToTable', {});
  });
});

describe('forward', () => {
  beforeEach(() => clearCalls(keyDown, keyUp));

  it('sends Alt+Right when a window is active', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ELEMENT_ID);

    await forward.call(driver);

    assertNthCalledWith(keyDown, 1, Key.ALT);
    assertNthCalledWith(keyDown, 2, Key.RIGHT);
    assertNthCalledWith(keyUp, 1, Key.RIGHT);
    assertNthCalledWith(keyUp, 2, Key.ALT);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');

    await assert.rejects(forward.call(driver), /No active window found/);
  });
});

describe('title (getTitle)', () => {
  beforeEach(() => clearCalls(keyDown, keyUp));

  it('returns the window title from the Name property', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, ELEMENT_ID, 'Untitled - Notepad');

    const result = await title.call(driver);

    assert.equal(result, 'Untitled - Notepad');
    assertCalledTimes(driver.sendCommand, 2);
    assertNthCalledWith(driver.sendCommand, 1, 'saveRootElementToTable', {});
    assertNthCalledWith(driver.sendCommand, 2, 'getProperty', {elementId: ELEMENT_ID, property: 'Name'});
  });

  it('returns an empty string when the window has no title', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, ELEMENT_ID, '');

    const result = await title.call(driver);

    assert.equal(result, '');
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');

    await assert.rejects(title.call(driver), /No active window found/);
  });
});

describe('setWindowRect', () => {
  beforeEach(() => clearCalls(keyDown, keyUp));

  // Validation, restore, merging omitted values and the resize-then-move order happen in
  // WincoreServer's setWindowRect RPC (csharp/WincoreServer.Tests/WindowRectTests.cs).
  it('forwards the values to the setWindowRect RPC on the root window and returns its rect', async () => {
    const driver = createMockDriver() as any;
    const newRect = {x: 200, y: 300, width: 1024, height: 768};
    driver.sendCommand.mock.mockImplementation(async (command: string) =>
      command === 'setWindowRect' ? newRect : ELEMENT_ID,
    );

    const result = await setWindowRect.call(driver, 200, null, 1024, undefined);

    assert.deepEqual(calls(driver.sendCommand), [
      ['saveRootElementToTable', {}],
      ['setWindowRect', {elementId: ELEMENT_ID, x: 200, y: null, width: 1024, height: undefined}],
    ]);
    assert.deepEqual(result, newRect);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');

    await assert.rejects(setWindowRect.call(driver, 0, 0, 800, 600), /No active window found/);
    assertNoCallTo(driver.sendCommand, 'setWindowRect');
  });
});
