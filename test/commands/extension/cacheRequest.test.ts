/**
 * Unit tests for pushCacheRequest (cacheRequest) extension command.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {assertCalledWith, assertNotCalled, calls} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
const {pushCacheRequest} = await import('../../../lib/commands/extension.js');

describe('pushCacheRequest', () => {
  it('throws when all properties are undefined', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(pushCacheRequest.call(driver, {}), /At least one property of the cache request must be set\./);
    await assert.rejects(
      pushCacheRequest.call(driver, {treeScope: undefined, treeFilter: undefined, automationElementMode: undefined}),
      /At least one property of the cache request must be set\./,
    );
    assertNotCalled(driver.sendCommand);
  });

  it('sends setCacheRequestTreeFilter command when treeFilter is set', async () => {
    const driver = createMockDriver() as any;
    await pushCacheRequest.call(driver, {treeFilter: 'TrueCondition'});
    const [call] = calls(driver.sendCommand).filter(([method]) => method === 'setCacheRequestTreeFilter');
    assert.ok(call, 'setCacheRequestTreeFilter was not sent');
    assert.equal(typeof call[1]?.condition, 'object');
    assert.notEqual(call[1].condition, null);
  });

  it('sends setCacheRequestTreeScope command when treeScope is set', async () => {
    const driver = createMockDriver() as any;
    await pushCacheRequest.call(driver, {treeScope: 'Children'});
    assertCalledWith(driver.sendCommand, 'setCacheRequestTreeScope', {scope: 'Children'});
  });

  it('sends setCacheRequestAutomationElementMode command when automationElementMode is set', async () => {
    const driver = createMockDriver() as any;
    await pushCacheRequest.call(driver, {automationElementMode: 'Full'});
    assertCalledWith(driver.sendCommand, 'setCacheRequestAutomationElementMode', {mode: 'Full'});
  });
});
