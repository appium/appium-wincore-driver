/**
 * Unit tests for lib/commands/device.ts
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {getDeviceTime, momentToDotNetFormat} from '../../lib/commands/device';
import {createMockDriver} from '../fixtures/driver';

describe('getDeviceTime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns formatted date string from C# server command', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('2026-02-25T10:30:00+00:00');
    const result = await getDeviceTime.call(driver);
    expect(result).toBe('2026-02-25T10:30:00+00:00');
    expect(driver.sendCommand).toHaveBeenCalledTimes(1);
    expect(driver.sendCommand).toHaveBeenCalledWith(
      'executePowerShellScript',
      expect.objectContaining({script: expect.any(String)}),
    );
  });

  it('uses ISO 8061 format by default when no format provided', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('2026-02-25T10:30:00+00:00');
    await getDeviceTime.call(driver);
    const [, params] = driver.sendCommand.mock.calls[0];
    expect(params.script).toContain('Get-Date');
    expect(params.script).toContain('yyyy-MM-ddTHH:mm:sszzz');
  });

  it('uses custom format when provided as second argument', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('25/02/2026');
    const result = await getDeviceTime.call(driver, undefined, 'dd/MM/yyyy');
    expect(result).toBe('25/02/2026');
    const [, params] = driver.sendCommand.mock.calls[0];
    expect(params.script).toContain('Get-Date');
    expect(params.script).toContain('dd/MM/yyyy');
  });
});

describe('momentToDotNetFormat', () => {
  it('translates the default Appium format and quotes literals', () => {
    expect(momentToDotNetFormat('YYYY-MM-DDTHH:mm:ssZ')).toBe("yyyy'-'MM'-'dd'T'HH':'mm':'sszzz");
  });

  it('translates date tokens that differ between moment.js and .NET', () => {
    expect(momentToDotNetFormat('YYYY/MM/DD')).toBe("yyyy'/'MM'/'dd");
    expect(momentToDotNetFormat('DD.MM.YY')).toBe("dd'.'MM'.'yy");
    expect(momentToDotNetFormat('HH:mm:ss.SSS')).toBe("HH':'mm':'ss'.'fff");
    expect(momentToDotNetFormat('dddd, MMMM D h:mm A')).toBe("dddd', 'MMMM' 'd' 'h':'mm' 'tt");
  });

  it('prefixes a lone single-letter token with %', () => {
    expect(momentToDotNetFormat('D')).toBe('%d');
    expect(momentToDotNetFormat('H')).toBe('%H');
  });

  it('keeps bracketed text and quotes as literals', () => {
    expect(momentToDotNetFormat('[Today is] dddd')).toBe("'Today is 'dddd");
    expect(momentToDotNetFormat("[it's] YYYY")).toBe("'it'\\''s 'yyyy");
  });
});
