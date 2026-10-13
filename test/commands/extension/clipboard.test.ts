/**
 * Unit tests for getClipboardBase64 and setClipboardFromBase64 extension commands.
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {assertCalledWith} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
const {getClipboardBase64, setClipboardFromBase64} = await import('../../../lib/commands/extension.js');

describe('getClipboardBase64', () => {
  it('returns plaintext clipboard by default', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'aGVsbG8=');
    const result = await getClipboardBase64.call(driver);
    assertCalledWith(driver.sendCommand, 'getClipboardText', {});
    assert.equal(result, 'aGVsbG8=');
  });

  it('accepts contentType as plaintext', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'dGVzdA==');
    const result = await getClipboardBase64.call(driver, 'plaintext');
    assertCalledWith(driver.sendCommand, 'getClipboardText', {});
    assert.equal(result, 'dGVzdA==');
  });

  it('accepts contentType as image', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'iVBORw0KGgo=');
    const result = await getClipboardBase64.call(driver, 'image');
    assertCalledWith(driver.sendCommand, 'getClipboardImage', {});
    assert.equal(result, 'iVBORw0KGgo=');
  });

  it('accepts contentType as object with contentType property', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'YmFzZTY0');
    const result = await getClipboardBase64.call(driver, {contentType: 'plaintext'});
    assertCalledWith(driver.sendCommand, 'getClipboardText', {});
    assert.equal(result, 'YmFzZTY0');
  });

  it('throws for unsupported content type', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      getClipboardBase64.call(driver, 'unsupported' as any),
      /Unsupported content type 'unsupported'/,
    );
  });
});

describe('setClipboardFromBase64', () => {
  it('throws when b64Content is missing', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(setClipboardFromBase64.call(driver, {} as any), /'b64Content' must be provided\./);
    await assert.rejects(
      setClipboardFromBase64.call(driver, {contentType: 'plaintext'} as any),
      /'b64Content' must be provided\./,
    );
  });

  it('sets plaintext clipboard by default', async () => {
    const driver = createMockDriver() as any;
    await setClipboardFromBase64.call(driver, {b64Content: 'aGVsbG8='});
    assertCalledWith(driver.sendCommand, 'setClipboardText', {b64Content: 'aGVsbG8='});
  });

  it('sets plaintext clipboard with explicit contentType', async () => {
    const driver = createMockDriver() as any;
    await setClipboardFromBase64.call(driver, {b64Content: 'dGVzdA==', contentType: 'plaintext'});
    assertCalledWith(driver.sendCommand, 'setClipboardText', {b64Content: 'dGVzdA=='});
  });

  it('sets image clipboard', async () => {
    const driver = createMockDriver() as any;
    await setClipboardFromBase64.call(driver, {b64Content: 'iVBORw0KGgo=', contentType: 'image'});
    assertCalledWith(driver.sendCommand, 'setClipboardImage', {b64Content: 'iVBORw0KGgo='});
  });

  it('throws for unsupported content type', async () => {
    const driver = createMockDriver() as any;
    await assert.rejects(
      setClipboardFromBase64.call(driver, {b64Content: 'abc', contentType: 'unsupported' as any}),
      /Unsupported content type 'unsupported'/,
    );
  });
});
