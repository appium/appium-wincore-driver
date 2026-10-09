/**
 * Unit tests for deleteFolder extension command.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {assertCalledWith, assertNotCalled} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
const {deleteFolder} = await import('../../../lib/commands/extension.js');

describe('deleteFolder', () => {
  it('throws when path is not provided', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(deleteFolder.call(driver, {} as any), /'path' must be provided/);
    assertNotCalled(driver.sendCommand);
  });

  it('sends deleteFolder command with recursive true by default', async () => {
    const driver = createMockDriver() as any;
    await deleteFolder.call(driver, {path: 'C:\\temp\\folder'});
    assertCalledWith(driver.sendCommand, 'deleteFolder', {path: 'C:\\temp\\folder', recursive: true});
  });

  it('sends deleteFolder command with recursive false when specified', async () => {
    const driver = createMockDriver() as any;
    await deleteFolder.call(driver, {path: 'C:\\temp\\folder', recursive: false});
    assertCalledWith(driver.sendCommand, 'deleteFolder', {path: 'C:\\temp\\folder', recursive: false});
  });

  it('passes path with special characters unchanged', async () => {
    const driver = createMockDriver() as any;
    await deleteFolder.call(driver, {path: 'C:\\temp\\folder[1]'});
    assertCalledWith(driver.sendCommand, 'deleteFolder', {path: 'C:\\temp\\folder[1]', recursive: true});
  });
});
