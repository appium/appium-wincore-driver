/**
 * Unit tests for additional lib/commands/app.ts functions
 * (getPageSource, getWindowHandle, getWindowHandles, getWindowRect, setWindow)
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledWith, calls, clearCalls, queueResolved} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const user32 = createUser32Mock();
const mockGetAllWindowHandles = user32.getAllWindowHandles;
mockUser32(user32);
await mockCommonModules();

const {getPageSource, getWindowHandle, getWindowHandles, getWindowRect, setWindow} =
  await import('../../../lib/commands/app.js');

describe('getPageSource', () => {
  beforeEach(() => clearCalls(mockGetAllWindowHandles, user32.trySetForegroundWindow));

  it('returns XML page source string', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '<Root><Child /></Root>');
    const result = await getPageSource.call(driver);
    assertCalledWith(driver.sendCommand, 'getPageSource', {});
    assert.equal(result, '<Root><Child /></Root>');
  });
});

describe('getWindowHandle', () => {
  beforeEach(() => clearCalls(mockGetAllWindowHandles, user32.trySetForegroundWindow));

  it('returns hex-formatted window handle', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'root-id', '12648430'); // 0x00C0FFEE
    const result = await getWindowHandle.call(driver);
    assert.equal(result, '0x00c0ffee');
  });

  it('pads handle to 8 hex digits', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'root-id', '1'); // 0x00000001
    const result = await getWindowHandle.call(driver);
    assert.equal(result, '0x00000001');
  });
});

describe('getWindowHandles', () => {
  beforeEach(() => clearCalls(mockGetAllWindowHandles, user32.trySetForegroundWindow));

  it('returns array of hex window handles for each visible window', async () => {
    mockGetAllWindowHandles.mock.mockImplementation(() => [100, 200]);
    const driver = createMockDriver() as any;
    const result = await getWindowHandles.call(driver);
    assert.equal(result.length, 2);
    assert.equal(result[0], '0x00000064');
    assert.equal(result[1], '0x000000c8');
  });

  it('returns empty array when no windows found', async () => {
    mockGetAllWindowHandles.mock.mockImplementation(() => []);
    const driver = createMockDriver() as any;
    const result = await getWindowHandles.call(driver);
    assert.deepEqual(result, []);
  });
});

describe('getWindowRect', () => {
  beforeEach(() => clearCalls(mockGetAllWindowHandles, user32.trySetForegroundWindow));

  it('returns rect object from C# server', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ({x: 10, y: 20, width: 800, height: 600}));
    const result = await getWindowRect.call(driver);
    assertCalledWith(driver.sendCommand, 'getRootRect', {});
    assert.deepEqual(result, {x: 10, y: 20, width: 800, height: 600});
  });
});

describe('setWindow', () => {
  beforeEach(() => clearCalls(mockGetAllWindowHandles, user32.trySetForegroundWindow));

  it('sets root element by numeric handle via setRootElementFromHandle (no tree search)', async () => {
    const driver = createMockDriver() as any;

    queueResolved(driver.sendCommand, '1.2.3');

    await setWindow.call(driver, '12345');

    assertCalledWith(driver.sendCommand, 'setRootElementFromHandle', {handle: 12345});
    assertCalledWith(user32.trySetForegroundWindow, 12345);
  });

  it('sets root element by window name when name is not numeric', async () => {
    const driver = createMockDriver() as any;

    queueResolved(driver.sendCommand, '5.6.7', undefined);

    await setWindow.call(driver, 'Calculator');

    const findCall = calls(driver.sendCommand).find(([method]) => method === 'findElement');
    assert.ok(findCall);
    assert.equal(findCall[1].scope, 'children');
    assertCalledWith(driver.sendCommand, 'setRootElementFromElementId', {elementId: '5.6.7'});
  });

  it('throws NoSuchWindowError when window is never found', {timeout: 30000}, async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => null);

    await assert.rejects(setWindow.call(driver, 'Nonexistent'), /No window was found/);
  });
});
