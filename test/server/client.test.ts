import {errors} from 'appium/driver';
/**
 * Unit tests for WincoreServerClient's server-error → WebDriver-error mapping.
 */
import {describe, it, expect, vi} from 'vitest';

import {WincoreServerClient} from '../../lib/server/client';

const log = {info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn()};

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
    expect(err).toBeInstanceOf(errors.InvalidElementStateError);
    expect(err.message).toContain('expand had no effect');
  });

  it('still maps PatternNotSupported to UnknownError', async () => {
    const err = await respondWith({code: 'PatternNotSupported', message: 'no pattern'}).catch((e) => e);
    expect(err).toBeInstanceOf(errors.UnknownError);
    expect(err).not.toBeInstanceOf(errors.InvalidElementStateError);
  });
});
