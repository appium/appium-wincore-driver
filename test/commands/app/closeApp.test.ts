/**
 * Unit tests for the W3C closeApp command (session-scoped).
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledTimes, assertNthCalledWith, queueResolved} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
await mockCommonModules();

const {closeApp} = await import('../../../lib/commands/app.js');

describe('closeApp (W3C)', () => {
  it('closes the session app window via C# server commands', async () => {
    const driver = createMockDriver() as any;
    queueResolved(driver.sendCommand, 'element-123', undefined, undefined);

    await closeApp.call(driver);

    assertCalledTimes(driver.sendCommand, 3);
    assertNthCalledWith(driver.sendCommand, 1, 'saveRootElementToTable', {});
    assertNthCalledWith(driver.sendCommand, 2, 'closeWindow', {elementId: 'element-123'});
    assertNthCalledWith(driver.sendCommand, 3, 'setRootElementNull', {});
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
