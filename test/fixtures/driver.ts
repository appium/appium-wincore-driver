/**
 * Shared test fixtures for extension command tests.
 */
import {mock} from 'node:test';
import type {Mock} from 'node:test';

import {BaseDriver, W3C_ELEMENT_KEY} from 'appium/driver.js';

type AnyMock = Mock<(...args: any[]) => any>;

export interface MockDriver {
  sendCommand: AnyMock;
  sendPowerShellCommand: AnyMock;
  log: {debug: AnyMock; info?: AnyMock; warn?: AnyMock};
  assertFeatureEnabled: AnyMock;
  appProcessIds: number[];
  caps: Record<string, unknown>;
  isIEContext: AnyMock;
  handleKeyAction: AnyMock;
}

export function createMockDriver(overrides?: Partial<MockDriver>): MockDriver {
  const sendCommand = mock.fn(async (..._args: any[]): Promise<any> => null);
  const sendPowerShellCommand = mock.fn(async (..._args: any[]): Promise<any> => '');
  const log = {debug: mock.fn(), info: mock.fn(), warn: mock.fn()};
  const assertFeatureEnabled = mock.fn();
  const isIEContext = mock.fn(() => false);
  const handleKeyAction = mock.fn(async (..._args: any[]): Promise<any> => undefined);
  const driver: MockDriver = {
    sendCommand,
    sendPowerShellCommand,
    log,
    assertFeatureEnabled,
    appProcessIds: [],
    caps: {},
    isIEContext,
    handleKeyAction,
    ...overrides,
  };
  return driver;
}

export const MOCK_ELEMENT: {[W3C_ELEMENT_KEY]: string} = {
  [W3C_ELEMENT_KEY]: '1.2.3.4.5',
};

/**
 * `execute()` resolves `this.constructor.executeMethodMap` and calls `this.executeMethod`
 * (mixed onto `BaseDriver.prototype` by `@appium/base-driver`) to dispatch `windows: x`
 * scripts. A plain `createMockDriver()` object has neither, so tests that exercise the
 * dispatcher (as opposed to calling command implementations directly) need this wired in.
 * Uses the real `@appium/base-driver` validation/dispatch logic rather than a
 * reimplementation, so tests fail if that behavior ever changes.
 *
 * Async: `lib/execute-method-map` is imported lazily so that tests can `mock.module()`
 * its transitive dependencies (e.g. user32) before it is first loaded.
 */
export async function withExecuteMethodDispatch<T extends object>(driver: T): Promise<T> {
  const {executeMethodMap} = await import('../../lib/execute-method-map.js');
  class MockDriverCtor {
    static executeMethodMap = executeMethodMap;
  }
  Object.setPrototypeOf(driver, MockDriverCtor.prototype);
  (driver as any).executeMethod = BaseDriver.prototype.executeMethod.bind(driver);
  return driver;
}
