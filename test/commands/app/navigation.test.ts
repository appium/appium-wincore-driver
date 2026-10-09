/**
 * Unit tests for lib/commands/app.ts: back, forward, getTitle, setWindowRect
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

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

  const MOCK_RECT = {x: 100, y: 100, width: 800, height: 600};

  function createDriverWithRect(windowRect = MOCK_RECT) {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ELEMENT_ID);
    driver.getWindowRect = mock.fn(async () => windowRect);
    return driver;
  }

  it('calls saveRoot + restore + move + resize when all four values provided', async () => {
    const driver = createDriverWithRect();

    const result = await setWindowRect.call(driver, 100, 100, 800, 600);

    assertCalledWith(driver.sendCommand, 'saveRootElementToTable', {});
    assertCalledWith(driver.sendCommand, 'restoreWindow', {elementId: ELEMENT_ID});
    assertCalledWith(driver.sendCommand, 'moveWindow', {elementId: ELEMENT_ID, x: 100, y: 100});
    assertCalledWith(driver.sendCommand, 'resizeWindow', {elementId: ELEMENT_ID, width: 800, height: 600});
    assertCalledTimes(driver.getWindowRect, 1);
    assert.deepEqual(result, MOCK_RECT);
  });

  it('calls only saveRoot + restore + move when width and height are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, 50, 75, null, null);

    assertCalledWith(driver.sendCommand, 'moveWindow', {elementId: ELEMENT_ID, x: 50, y: 75});
    assertNoCallTo(driver.sendCommand, 'resizeWindow');
  });

  it('calls only saveRoot + restore + resize when x and y are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, null, null, 1024, 768);

    assertCalledWith(driver.sendCommand, 'resizeWindow', {elementId: ELEMENT_ID, width: 1024, height: 768});
    assertNoCallTo(driver.sendCommand, 'moveWindow');
  });

  it('skips move and resize when all arguments are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, null, null, null, null);

    assertNoCallTo(driver.sendCommand, 'moveWindow');
    assertNoCallTo(driver.sendCommand, 'resizeWindow');
  });

  it('returns the new window rect from getWindowRect', async () => {
    const expectedRect = {x: 200, y: 300, width: 1024, height: 768};
    const driver = createDriverWithRect(expectedRect);

    const result = await setWindowRect.call(driver, 200, 300, 1024, 768);

    assert.deepEqual(result, expectedRect);
  });

  it('throws InvalidArgumentError for negative width', async () => {
    const driver = createDriverWithRect();

    await assert.rejects(setWindowRect.call(driver, 0, 0, -1, 600), /width must be a non-negative integer/);
  });

  it('throws InvalidArgumentError for negative height', async () => {
    const driver = createDriverWithRect();

    await assert.rejects(setWindowRect.call(driver, 0, 0, 800, -1), /height must be a non-negative integer/);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');
    driver.getWindowRect = mock.fn();

    await assert.rejects(setWindowRect.call(driver, 0, 0, 800, 600), /No active window found/);
  });
});
