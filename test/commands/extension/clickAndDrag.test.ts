/**
 * Unit tests for executeClickAndDrag extension command.
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {
  assertCalledTimes,
  assertCalledWith,
  assertNthCalledWith,
  clearCalls,
  queueResolved,
} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const user32 = createUser32Mock();
mockUser32(user32);
const {executeClickAndDrag} = await import('../../../lib/commands/extension.js');

describe('executeClickAndDrag', () => {
  beforeEach(() => {
    clearCalls(...Object.values(user32));
  });

  it('throws when only startX is provided without startY', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    await assert.rejects(
      executeClickAndDrag.call(driver, {startX: 100, endX: 200, endY: 200}),
      /Both startX and startY must be provided/,
    );
  });

  it('throws when only endX is provided without endY', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    await assert.rejects(
      executeClickAndDrag.call(driver, {startX: 0, startY: 0, endX: 100}),
      /Both endX and endY must be provided/,
    );
  });

  it('throws when neither start coords nor startElementId provided', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    await assert.rejects(
      executeClickAndDrag.call(driver, {endX: 100, endY: 100}),
      /Either startElementId or startX and startY must be provided/,
    );
  });

  it('drags from start to end coordinates with mouseDown/mouseUp', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    const {mouseMoveAbsolute, mouseDown, mouseUp} = user32;

    await executeClickAndDrag.call(driver, {
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
    });

    assertCalledTimes(mouseMoveAbsolute, 2);
    assertNthCalledWith(mouseMoveAbsolute, 1, 0, 0, 0);
    assertNthCalledWith(mouseMoveAbsolute, 2, 100, 100, 500, undefined);
    assertCalledWith(mouseDown, 0);
    assertCalledWith(mouseUp, 0);
  });

  it('drags with elementId when element exists', async () => {
    const driver = createMockDriver() as any;
    (driver as any).caps = {};
    const rect = {x: 10, y: 20, width: 100, height: 50};
    // lookupElement returns true, getRect returns rect — twice (start + end)
    queueResolved(driver.sendCommand, true, rect, true, rect);
    const {mouseMoveAbsolute} = user32;

    await executeClickAndDrag.call(driver, {
      startElementId: '1.2.3.4.5',
      endElementId: '1.2.3.4.5',
    });

    assertCalledTimes(mouseMoveAbsolute, 2);
    assertNthCalledWith(mouseMoveAbsolute, 1, 60, 45, 0);
    assertNthCalledWith(mouseMoveAbsolute, 2, 60, 45, 500, undefined);
  });
});
