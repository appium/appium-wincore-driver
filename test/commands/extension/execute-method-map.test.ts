/**
 * Unit tests for the executeMethodMap dispatch path, focused on the arg-shape
 * normalization in coerceExecuteMethodArgs (raw W3C element -> { elementId },
 * legacy two-positional-arg setValue(element, value) -> single opts object) and the
 * error cases when a script or its args don't match anything this driver understands.
 * Uses the real @appium/base-driver executeMethod (via withExecuteMethodDispatch)
 * rather than a reimplementation, so these tests track real validation behavior.
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import {W3C_ELEMENT_KEY} from 'appium/driver.js';

import {createMockDriver, withExecuteMethodDispatch, MOCK_ELEMENT} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {calls, assertCalledTimes, assertCalledWith} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
await mockCommonModules();
const executeMethods = await import('../../../lib/commands/execute-methods.js');
const extension = await import('../../../lib/commands/extension.js');

describe('execute (executeMethodMap dispatch)', () => {
  let driver: any;

  beforeEach(async () => {
    driver = (await withExecuteMethodDispatch(createMockDriver())) as any;
    Object.assign(driver, extension, executeMethods);
  });

  it('routes a zero-arg script straight through', async () => {
    driver.launchApp = mock.fn(async () => undefined);
    await extension.execute.call(driver, 'windows: launchApp', []);
    assertCalledTimes(driver.launchApp, 1);
  });

  it('accepts the standard { elementId } opts object', async () => {
    const elementId = MOCK_ELEMENT[W3C_ELEMENT_KEY];
    await extension.execute.call(driver, 'windows: invoke', [{elementId}]);
    assertCalledWith(driver.sendCommand, 'invokeElement', {elementId});
  });

  it('reassembles a multi-field opts object (click) correctly', async () => {
    await extension.execute.call(driver, 'windows: click', [{x: 5, y: 7}]);
    assert.ok(!calls(driver.sendCommand).some(([method]) => method === 'invokeElement'));
  });

  it('normalizes a raw W3C element (WebdriverIO calling convention) into { elementId }', async () => {
    // e.g. calc.executeScript('windows: invoke', [oneBtn]) - WebdriverIO serializes
    // the element handle to a raw W3C element object, not { elementId }.
    await extension.execute.call(driver, 'windows: invoke', [MOCK_ELEMENT]);
    assertCalledWith(driver.sendCommand, 'invokeElement', {elementId: MOCK_ELEMENT[W3C_ELEMENT_KEY]});
  });

  it('normalizes the legacy setValue(element, value) two-positional-arg call', async () => {
    // e.g. notepad.executeScript('windows: setValue', [textArea, 'some value'])
    await extension.execute.call(driver, 'windows: setValue', [MOCK_ELEMENT, 'some value']);
    assertCalledWith(driver.sendCommand, 'setElementValue', {
      elementId: MOCK_ELEMENT[W3C_ELEMENT_KEY],
      value: 'some value',
    });
  });

  it('throws InvalidArgumentError when args do not match any understood shape', async () => {
    // Two positional args for a script other than setValue - nothing normalizes this.
    await assert.rejects(
      extension.execute.call(driver, 'windows: invoke', [MOCK_ELEMENT, 'unexpected-extra-arg']),
      /Did not get correct format of arguments/,
    );
  });

  it('throws UnknownCommandError for an unrecognized windows: script', async () => {
    await assert.rejects(
      extension.execute.call(driver, 'windows: unknownCommand', []),
      /Unsupported execute method 'windows: unknownCommand'/,
    );
  });
});
