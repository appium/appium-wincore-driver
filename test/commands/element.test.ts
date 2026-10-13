/**
 * Unit tests for lib/commands/element.ts
 */
import assert from 'node:assert/strict';
import {describe, it, mock} from 'node:test';

import {W3C_ELEMENT_KEY} from 'appium/driver.js';

import {createMockDriver} from '../fixtures/driver.js';
import {assertCalledTimes, assertCalledWith, assertNthCalledWith, queueResolved} from '../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../helpers/user32.js';

mockUser32(createUser32Mock());

const {
  getProperty,
  getAttribute,
  active,
  getName,
  getText,
  clear,
  getElementRect,
  elementDisplayed,
  elementSelected,
  elementEnabled,
  getElementScreenshot,
} = await import('../../lib/commands/element.js');

const ELEMENT_ID = '1.2.3.4.5';

describe('getProperty', () => {
  it('sends getProperty command and returns result', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'Calculator');
    const result = await getProperty.call(driver, 'name', ELEMENT_ID);
    assertCalledWith(driver.sendCommand, 'getProperty', {elementId: ELEMENT_ID, property: 'name'});
    assert.equal(result, 'Calculator');
  });

  it('returns the value for runtimeid property', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '1.2.3.4.5');
    const result = await getProperty.call(driver, 'runtimeid', ELEMENT_ID);
    assertCalledWith(driver.sendCommand, 'getProperty', {elementId: ELEMENT_ID, property: 'runtimeid'});
    assert.equal(result, '1.2.3.4.5');
  });
});

describe('getAttribute', () => {
  it('delegates to getProperty and returns result', async () => {
    const driver = createMockDriver() as any;
    driver.getProperty = mock.fn(async () => 'SomeValue');
    driver.log.warn = mock.fn();
    const result = await getAttribute.call(driver, 'name', ELEMENT_ID);
    assertCalledWith(driver.getProperty, 'name', ELEMENT_ID);
    assert.equal(result, 'SomeValue');
  });
});

describe('active', () => {
  it('returns the focused element wrapped in W3C element key', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '9.8.7.6.5');
    const result = await active.call(driver);
    assertCalledWith(driver.sendCommand, 'findElementFocused', {});
    assert.equal(result[W3C_ELEMENT_KEY], '9.8.7.6.5');
  });
});

describe('getName', () => {
  it('returns the tag name from the command', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'Button');
    const result = await getName.call(driver, ELEMENT_ID);
    assertCalledWith(driver.sendCommand, 'getTagName', {elementId: ELEMENT_ID});
    assert.equal(result, 'Button');
  });
});

describe('getText', () => {
  it('returns the text content from the command', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'Hello World');
    const result = await getText.call(driver, ELEMENT_ID);
    assertCalledWith(driver.sendCommand, 'getText', {elementId: ELEMENT_ID});
    assert.equal(result, 'Hello World');
  });
});

describe('clear', () => {
  it('sends setElementValue command with empty string', async () => {
    const driver = createMockDriver() as any;
    await clear.call(driver, ELEMENT_ID);
    assertCalledWith(driver.sendCommand, 'setElementValue', {elementId: ELEMENT_ID, value: ''});
  });
});

describe('getElementRect', () => {
  it('returns rect adjusted relative to root rect', async () => {
    const driver = createMockDriver() as any;
    queueResolved(
      driver.sendCommand,
      {x: 110, y: 220, width: 50, height: 30},
      {x: 100, y: 200, width: 800, height: 600},
    );

    const result = await getElementRect.call(driver, ELEMENT_ID);
    assert.equal(result.x, 10);
    assert.equal(result.y, 20);
    assert.equal(result.width, 50);
    assert.equal(result.height, 30);
  });

  it('clamps adjusted coordinates to max int32', async () => {
    const driver = createMockDriver() as any;
    queueResolved(
      driver.sendCommand,
      {x: 0x7fffffff, y: 0, width: 10, height: 10},
      {x: 0, y: 0, width: 800, height: 600},
    );

    const result = await getElementRect.call(driver, ELEMENT_ID);
    assert.equal(result.x, 0x7fffffff);
  });

  it('handles Infinity x value by clamping to max int32', async () => {
    const driver = createMockDriver() as any;
    queueResolved(
      driver.sendCommand,
      {x: Infinity, y: 0, width: 50, height: 30},
      {x: 0, y: 0, width: 800, height: 600},
    );

    const result = await getElementRect.call(driver, ELEMENT_ID);
    assert.equal(result.x, 0x7fffffff);
  });
});

describe('elementDisplayed', () => {
  it('returns true when IsOffscreen is false (boolean)', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => false);
    const result = await elementDisplayed.call(driver, ELEMENT_ID);
    assert.equal(result, true);
  });

  it('returns false when IsOffscreen is true (boolean)', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => true);
    const result = await elementDisplayed.call(driver, ELEMENT_ID);
    assert.equal(result, false);
  });

  it('handles string "False" for backward compat', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'False');
    const result = await elementDisplayed.call(driver, ELEMENT_ID);
    assert.equal(result, true);
  });
});

describe('elementSelected', () => {
  it('returns true when isElementSelected returns true', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => true);
    const result = await elementSelected.call(driver, ELEMENT_ID);
    assert.equal(result, true);
  });

  it('returns false when isElementSelected returns false', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => false);
    const result = await elementSelected.call(driver, ELEMENT_ID);
    assert.equal(result, false);
  });

  it('falls back to getToggleState when isElementSelected throws', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementationOnce(async () => {
      throw new Error('No SelectionItemPattern');
    }, 0);
    driver.sendCommand.mock.mockImplementationOnce(async () => 'On', 1);
    const result = await elementSelected.call(driver, ELEMENT_ID);
    assert.equal(result, true);
  });

  it('returns false from getToggleState when toggle is Off', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementationOnce(async () => {
      throw new Error('No SelectionItemPattern');
    }, 0);
    driver.sendCommand.mock.mockImplementationOnce(async () => 'Off', 1);
    const result = await elementSelected.call(driver, ELEMENT_ID);
    assert.equal(result, false);
  });
});

describe('elementEnabled', () => {
  it('returns true when IsEnabled is true (boolean)', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => true);
    const result = await elementEnabled.call(driver, ELEMENT_ID);
    assert.equal(result, true);
  });

  it('returns false when IsEnabled is false (boolean)', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => false);
    const result = await elementEnabled.call(driver, ELEMENT_ID);
    assert.equal(result, false);
  });
});

describe('getElementScreenshot', () => {
  const ROOT_ID = '0.1.2.3';
  const FAKE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('returns base64 PNG from the screenshot command', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, ROOT_ID, FAKE_BASE64);

    const result = await getElementScreenshot.call(driver, ELEMENT_ID);

    assert.equal(result, FAKE_BASE64);
    assertCalledTimes(driver.sendCommand, 2);
    assertNthCalledWith(driver.sendCommand, 1, 'saveRootElementToTable', {});
    assertNthCalledWith(driver.sendCommand, 2, 'getElementScreenshot', {elementId: ELEMENT_ID});
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '');

    await assert.rejects(getElementScreenshot.call(driver, ELEMENT_ID), /No active window found/);
  });
});
