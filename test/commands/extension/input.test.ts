/**
 * Unit tests for executeKeys, executeClick, executeHover, executeScroll extension commands.
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {
  assertCalled,
  assertCalledTimes,
  assertCalledWith,
  assertNotCalled,
  assertNthCalledWith,
  clearCalls,
  queueResolved,
} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const user32 = createUser32Mock({
  // Same rule as the real one: [a-z0-9] go as scan codes unless forceUnicode.
  sendsAsUnicodePacket: mock.fn((char: string, forceUnicode = false) => forceUnicode || !/[a-z0-9]/.test(char)),
});
const utilMocks = {sleep: mock.fn(async () => undefined)};

mockUser32(user32);
mock.module('../../../lib/util.js', {
  exports: {...(await import('../../../lib/util.js')), ...utilMocks},
});

const {executeKeys, executeClick, executeHover, executeScroll} = await import('../../../lib/commands/extension.js');

describe('executeKeys', () => {
  beforeEach(() => {
    clearCalls(...Object.values(user32), ...Object.values(utilMocks));
  });

  it('throws when neither pause, text nor virtualKeyCode is set', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      executeKeys.call(driver, {actions: {}, forceUnicode: false}),
      /Either pause, text or virtualKeyCode should be set\./,
    );
  });

  it('throws when multiple of pause, text, virtualKeyCode are set', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      executeKeys.call(driver, {actions: {pause: 100, text: 'a'}, forceUnicode: false}),
      /Either pause, text or virtualKeyCode should be set\./,
    );
  });

  it('handles pause action', async () => {
    const driver = createMockDriver() as any;
    await executeKeys.call(driver, {actions: {pause: 50}, forceUnicode: false});
    assertNotCalled(driver.sendPowerShellCommand);
  });

  it('types each text character as one down+up keystroke', async () => {
    const driver = createMockDriver() as any;
    const {typeKey, keyDown, keyUp} = await import('../../../lib/winapi/user32.js');
    await executeKeys.call(driver, {actions: {text: 'ab'}, forceUnicode: false});
    assertNthCalledWith(typeKey, 1, 'a', false);
    assertNthCalledWith(typeKey, 2, 'b', false);
    assertNotCalled(keyDown);
    assertNotCalled(keyUp);
  });

  it('sends only key-down for a text action with down: true', async () => {
    const driver = createMockDriver() as any;
    const {typeKey, keyDown, keyUp} = await import('../../../lib/winapi/user32.js');
    await executeKeys.call(driver, {actions: {text: 'a', down: true}, forceUnicode: false});
    assertCalledWith(keyDown, 'a', false);
    assertNotCalled(keyUp);
    assertNotCalled(typeKey);
  });

  it('pauses after Unicode-packet characters only (space, punctuation), not scan-code letters', async () => {
    const driver = createMockDriver() as any;
    const {sleep} = await import('../../../lib/util.js');
    await executeKeys.call(driver, {actions: {text: 'hello world!'}, forceUnicode: false});
    // ' ' and '!' are VK_PACKET keystrokes; the ten letters are scan codes.
    assertCalledTimes(sleep, 2);
    assertCalledWith(sleep, 30);
  });

  it('pauses after every character with forceUnicode', async () => {
    const driver = createMockDriver() as any;
    const {sleep} = await import('../../../lib/util.js');
    await executeKeys.call(driver, {actions: {text: 'abc'}, forceUnicode: true});
    assertCalledTimes(sleep, 3);
  });

  it('handles virtualKeyCode action', async () => {
    const driver = createMockDriver() as any;
    const {sendKeyboardEvents} = await import('../../../lib/winapi/user32.js');
    await executeKeys.call(driver, {actions: {virtualKeyCode: 0x41, down: true}, forceUnicode: false});
    assertCalled(sendKeyboardEvents);
  });
});

describe('executeClick', () => {
  beforeEach(() => {
    clearCalls(...Object.values(user32), ...Object.values(utilMocks));
  });

  it('throws when only x is provided without y', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(executeClick.call(driver, {x: 100}), /Both x and y must be provided/);
  });

  it('clicks at coordinates when x and y provided', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    const {mouseMoveAbsolute, mouseDown, mouseUp} = await import('../../../lib/winapi/user32.js');
    await executeClick.call(driver, {x: 100, y: 200});
    assertCalledWith(mouseMoveAbsolute, 100, 200, 0);
    assertCalled(mouseDown);
    assertCalled(mouseUp);
  });

  it('clicks with elementId when element exists', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    const rect = {x: 10, y: 20, width: 100, height: 50};
    // lookupElement returns true, getRect returns rect object
    queueResolved(driver.sendCommand, true, rect);
    const {mouseMoveAbsolute} = await import('../../../lib/winapi/user32.js');
    await executeClick.call(driver, {elementId: '1.2.3.4.5'});
    assertCalledWith(mouseMoveAbsolute, 60, 45, 0); // center of rect
  });
});

describe('executeHover', () => {
  beforeEach(() => {
    clearCalls(...Object.values(user32), ...Object.values(utilMocks));
  });

  it('throws when only startX is provided without startY', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(executeHover.call(driver, {startX: 100}), /Both startX and startY must be provided/);
  });

  it('throws when only endX is provided without endY', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      executeHover.call(driver, {startX: 0, startY: 0, endX: 100}),
      /Both endX and endY must be provided/,
    );
  });

  it('moves from start to end coordinates', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    const {mouseMoveAbsolute} = await import('../../../lib/winapi/user32.js');
    await executeHover.call(driver, {startX: 0, startY: 0, endX: 100, endY: 100});
    assertCalledTimes(mouseMoveAbsolute, 2);
  });
});

describe('executeScroll', () => {
  beforeEach(() => {
    clearCalls(...Object.values(user32), ...Object.values(utilMocks));
  });

  it('throws when elementId and x/y are both provided', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      executeScroll.call(driver, {elementId: '1.2.3.4.5', x: 100, y: 100}),
      /Either elementId or x and y must be provided/,
    );
  });

  it('throws when only x is provided without y', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(executeScroll.call(driver, {x: 100}), /Both x and y must be provided/);
  });

  it('scrolls at coordinates when x, y, deltaX, deltaY provided', async () => {
    const driver = createMockDriver() as any;
    const {mouseMoveAbsolute, mouseScroll} = await import('../../../lib/winapi/user32.js');
    await executeScroll.call(driver, {x: 100, y: 200, deltaX: 0, deltaY: 50});
    assertCalledWith(mouseMoveAbsolute, 100, 200, 0);
    assertCalledWith(mouseScroll, 0, 50);
  });
});
