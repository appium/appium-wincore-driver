/**
 * Unit tests for the execute command router (`windows:` scripts now dispatch
 * exclusively through the standard executeMethodMap path - see
 * execute-method-map.test.ts for elementId-normalization and arg-shape coverage).
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver, withExecuteMethodDispatch, MOCK_ELEMENT} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledTimes, assertCalledWith, assertNotCalled, calls, queueResolved} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
await mockCommonModules();
const executeMethods = await import('../../../lib/commands/execute-methods.js');
const extension = await import('../../../lib/commands/extension.js');

const findCall = (fn: any, method: string) => {
  const call = calls(fn).find(([m]) => m === method);
  assert.ok(call, `no '${method}' call`);
  return call;
};

describe('execute (command router)', () => {
  let driver: any;

  beforeEach(async () => {
    driver = (await withExecuteMethodDispatch(createMockDriver())) as any;
    Object.assign(driver, extension, executeMethods);
  });

  it('routes windows:launchApp to windowsLaunchApp', async () => {
    driver.launchApp = mock.fn(async () => undefined);
    await extension.execute.call(driver, 'windows: launchApp', []);
    assertCalledTimes(driver.launchApp, 1);
  });

  it('routes windows:closeApp to windowsCloseApp', async () => {
    driver.closeApp = mock.fn(async () => undefined);
    await extension.execute.call(driver, 'windows: closeApp', []);
    assertCalledTimes(driver.closeApp, 1);
  });

  it('routes windows:getDeviceTime with format arg', async () => {
    driver.getDeviceTime = mock.fn(async () => '2026');
    const result = await extension.execute.call(driver, 'windows: getDeviceTime', [{format: 'yyyy'}]);
    assertCalledWith(driver.getDeviceTime, undefined, 'yyyy');
    assert.equal(result, '2026');
  });

  it('routes windows:getDeviceTime without format defaults to ISO 8601', async () => {
    driver.getDeviceTime = mock.fn(async () => '2026-03-03T10:00:00+00:00');
    const result = await extension.execute.call(driver, 'windows: getDeviceTime', []);
    assertCalledWith(driver.getDeviceTime, undefined, undefined);
    assert.equal(result, '2026-03-03T10:00:00+00:00');
  });

  it('routes windows:deleteFile to deleteFile via sendCommand', async () => {
    await extension.execute.call(driver, 'windows: deleteFile', [{path: 'C:\\temp\\file.txt'}]);
    assertCalledWith(driver.sendCommand, 'deleteFile', {path: 'C:\\temp\\file.txt'});
  });

  it('routes windows:invoke to patternInvoke via sendCommand', async () => {
    await extension.execute.call(driver, 'windows: invoke', [MOCK_ELEMENT]);
    assertCalledWith(driver.sendCommand, 'invokeElement', {
      elementId: MOCK_ELEMENT['element-6066-11e4-a52e-4f735466cecf'],
    });
  });

  it('throws UnknownCommandError for unknown windows command', async () => {
    await assert.rejects(
      extension.execute.call(driver, 'windows: unknownCommand', []),
      /Unsupported execute method 'windows: unknownCommand'/,
    );
  });

  it('routes powerShell to executePowerShellScript', async () => {
    driver.caps = {};
    driver.sendCommand.mock.mockImplementation(async () => 'output');
    const result = await extension.execute.call(driver, 'powerShell', ['Get-Process']);
    assert.partialDeepStrictEqual(findCall(driver.sendCommand, 'executePowerShellScript')[1], {script: 'Get-Process'});
    assert.equal(result, 'output');
  });

  it('routes return window.name to sendCommand calls', async () => {
    queueResolved(driver.sendCommand, 'root-element-id', 'WindowName');
    const result = await extension.execute.call(driver, 'return window.name', []);
    assertCalledWith(driver.sendCommand, 'saveRootElementToTable', {});
    assertCalledWith(driver.sendCommand, 'getProperty', {elementId: 'root-element-id', property: 'Name'});
    assert.equal(result, 'WindowName');
  });

  it('throws NotImplementedError for non-matching script', async () => {
    await assert.rejects(extension.execute.call(driver, 'unknownScript', []), /Method is not implemented/);
  });

  it('routes mobile:getContexts to getWebViewDetails', async () => {
    driver.caps = {webviewEnabled: true};
    const mockDetails = {
      info: {Browser: 'Chrome/120.0.0.0'},
      pages: [
        {
          id: 'page1',
          title: 'Test',
          url: 'https://example.com',
          webSocketDebuggerUrl: 'ws://localhost:10900/devtools/page/page1',
          description: '',
          devtoolsFrontendUrl: '',
          faviconUrl: '',
          type: 'page',
        },
      ],
    };
    driver.getWebViewDetails = mock.fn(async () => mockDetails);

    const result = (await extension.execute.call(driver, 'mobile:getContexts', [{}])) as any[];
    assertCalledWith(driver.getWebViewDetails, undefined);
    assert.deepEqual(result[0], {id: 'NATIVE_APP'});
    assert.partialDeepStrictEqual(result[1], {id: 'WEBVIEW_page1', title: 'Test', url: 'https://example.com'});
  });

  it('proxies arbitrary script to chromedriver jwproxy when jwpProxyActive', async () => {
    const mockCommand = mock.fn(async () => 'proxy-result');
    driver.chromedriver = {
      jwproxy: {
        downstreamProtocol: 'W3C',
        command: mockCommand,
      },
    };
    driver.jwpProxyActive = true;
    driver.proxyActive = mock.fn(() => true);

    const result = await extension.execute.call(driver, 'return document.title', []);
    assertCalledWith(mockCommand, '/execute/sync', 'POST', {script: 'return document.title', args: []});
    assert.equal(result, 'proxy-result');
  });

  it('proxy uses /execute endpoint for MJSONWP protocol', async () => {
    const mockCommand = mock.fn(async () => undefined);
    driver.chromedriver = {
      jwproxy: {
        downstreamProtocol: 'MJSONWP',
        command: mockCommand,
      },
    };
    driver.jwpProxyActive = true;
    driver.proxyActive = mock.fn(() => true);

    await extension.execute.call(driver, 'return 1', []);
    const [call] = calls(mockCommand);
    assertCalledTimes(mockCommand, 1);
    assert.deepEqual(call.slice(0, 2), ['/execute', 'POST']);
    assert.ok(call.length === 3 && call[2] != null);
  });

  it('powerShell runs before proxy passthrough even when jwpProxyActive', async () => {
    const mockCommand = mock.fn();
    driver.chromedriver = {jwproxy: {downstreamProtocol: 'W3C', command: mockCommand}};
    driver.jwpProxyActive = true;
    driver.proxyActive = mock.fn(() => true);
    driver.assertFeatureEnabled = mock.fn();
    driver.caps = {};
    driver.sendCommand.mock.mockImplementation(async () => 'output');

    await extension.execute.call(driver, 'powerShell', [{script: 'Get-Date'}]);
    assertNotCalled(mockCommand);
    assert.partialDeepStrictEqual(findCall(driver.sendCommand, 'executePowerShellScript')[1], {script: 'Get-Date'});
  });
});
