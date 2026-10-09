/**
 * Unit tests for the W3C launchApp command (session-scoped).
 */
import assert from 'node:assert/strict';
import {describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledTimes, assertCalledWith} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
await mockCommonModules();

const {launchApp} = await import('../../../lib/commands/app.js');

describe('launchApp (W3C)', () => {
  it('re-launches the session app via changeRootElement', async () => {
    const driver = createMockDriver() as any;
    driver.caps = {app: 'C:\\Program Files\\notepad.exe'};
    driver.changeRootElement = mock.fn(async () => undefined);

    await launchApp.call(driver);

    assertCalledWith(driver.changeRootElement, 'C:\\Program Files\\notepad.exe');
    assertCalledTimes(driver.changeRootElement, 1);
  });

  it('re-launches a UWP app via changeRootElement', async () => {
    const driver = createMockDriver() as any;
    driver.caps = {app: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App'};
    driver.changeRootElement = mock.fn(async () => undefined);

    await launchApp.call(driver);

    assertCalledWith(driver.changeRootElement, 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App');
  });

  it('throws InvalidArgumentError when app capability is not set', async () => {
    const driver = createMockDriver() as any;
    driver.caps = {};

    await assert.rejects(launchApp.call(driver), /No app capability is set/);
  });

  it('throws InvalidArgumentError when app is "root"', async () => {
    const driver = createMockDriver() as any;
    driver.caps = {app: 'root'};

    await assert.rejects(launchApp.call(driver), /No app capability is set/);
  });

  it('throws InvalidArgumentError when app is "none"', async () => {
    const driver = createMockDriver() as any;
    driver.caps = {app: 'none'};

    await assert.rejects(launchApp.call(driver), /No app capability is set/);
  });
});
