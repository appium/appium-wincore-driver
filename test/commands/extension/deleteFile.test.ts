/**
 * Unit tests for deleteFile extension command.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {assertCalledTimes, assertCalledWith, assertNotCalled} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
const {deleteFile} = await import('../../../lib/commands/extension.js');

describe('deleteFile', () => {
  it('throws when path is not provided', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(deleteFile.call(driver, {} as any), /'path' must be provided/);
    await assert.rejects(deleteFile.call(driver, {path: ''}), /'path' must be provided/);
    assertNotCalled(driver.sendCommand);
  });

  it('sends deleteFile command with path', async () => {
    const driver = createMockDriver() as any;
    await deleteFile.call(driver, {path: 'C:\\temp\\file.txt'});
    assertCalledWith(driver.sendCommand, 'deleteFile', {path: 'C:\\temp\\file.txt'});
  });

  it('asserts MODIFY_FS_FEATURE before sending command', async () => {
    const driver = createMockDriver() as any;
    await deleteFile.call(driver, {path: 'C:\\temp\\file.txt'});
    assertCalledTimes(driver.assertFeatureEnabled, 1);
  });

  it('passes path with special characters unchanged', async () => {
    const driver = createMockDriver() as any;
    await deleteFile.call(driver, {path: 'C:\\temp\\file[1].txt'});
    assertCalledWith(driver.sendCommand, 'deleteFile', {path: 'C:\\temp\\file[1].txt'});
  });
});
