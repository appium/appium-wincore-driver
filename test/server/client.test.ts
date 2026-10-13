/**
 * Unit tests for WincoreServerClient's server-error → WebDriver-error mapping.
 */
import assert from 'node:assert/strict';
import {describe, it, mock} from 'node:test';

import {errors} from 'appium/driver.js';

import {WincoreServerClient} from '../../lib/server/client.js';

const log = {info: mock.fn(), debug: mock.fn(), warn: mock.fn(), error: mock.fn()};

// Drives the client without spawning WincoreServer.exe: a fake process captures the
// request, then the response line is fed through the same stdout buffer path.
async function respondWith(error: {code: string; message: string}): Promise<unknown> {
  const client = new WincoreServerClient(log);
  const written: string[] = [];
  (client as any).process = {stdin: {write: (s: string) => written.push(s)}};
  const pending = client.sendCommand('expandElement', {elementId: '1.2.3'});
  const {id} = JSON.parse(written[0]);
  (client as any).buffer = JSON.stringify({id, error, duration_ms: 1}) + '\n';
  (client as any).processBuffer();
  return pending;
}

describe('WincoreServerClient error mapping', () => {
  it('maps InvalidElementState to InvalidElementStateError', async () => {
    const err = await respondWith({code: 'InvalidElementState', message: 'expand had no effect'}).catch((e) => e);
    assert.ok(err instanceof errors.InvalidElementStateError);
    assert.ok(err.message.includes('expand had no effect'));
  });

  it('still maps PatternNotSupported to UnknownError', async () => {
    const err = await respondWith({code: 'PatternNotSupported', message: 'no pattern'}).catch((e) => e);
    assert.ok(err instanceof errors.UnknownError);
    assert.ok(!(err instanceof errors.InvalidElementStateError));
  });
});
