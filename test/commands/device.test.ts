/**
 * Unit tests for lib/commands/device.ts
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {getDeviceTime, momentToDotNetFormat} from '../../lib/commands/device.js';
import {createMockDriver} from '../fixtures/driver.js';
import {assertCalledTimes, calls} from '../helpers/mock.js';

describe('getDeviceTime', () => {
  it('returns formatted date string from C# server command', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '2026-02-25T10:30:00+00:00');
    const result = await getDeviceTime.call(driver);
    assert.equal(result, '2026-02-25T10:30:00+00:00');
    assertCalledTimes(driver.sendCommand, 1);
    const [method, params] = calls(driver.sendCommand)[0];
    assert.equal(method, 'executePowerShellScript');
    assert.equal(typeof params.script, 'string');
  });

  it('uses ISO 8061 format by default when no format provided', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '2026-02-25T10:30:00+00:00');
    await getDeviceTime.call(driver);
    const [, params] = calls(driver.sendCommand)[0];
    assert.ok(params.script.includes('Get-Date'));
    assert.ok(params.script.includes('yyyy-MM-ddTHH:mm:sszzz'));
  });

  it('uses custom format when provided as second argument', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => '25/02/2026');
    const result = await getDeviceTime.call(driver, undefined, 'dd/MM/yyyy');
    assert.equal(result, '25/02/2026');
    const [, params] = calls(driver.sendCommand)[0];
    assert.ok(params.script.includes('Get-Date'));
    assert.ok(params.script.includes('dd/MM/yyyy'));
  });
});

describe('momentToDotNetFormat', () => {
  it('translates the default Appium format and quotes literals', () => {
    assert.equal(momentToDotNetFormat('YYYY-MM-DDTHH:mm:ssZ'), "yyyy'-'MM'-'dd'T'HH':'mm':'sszzz");
  });

  it('translates date tokens that differ between moment.js and .NET', () => {
    assert.equal(momentToDotNetFormat('YYYY/MM/DD'), "yyyy'/'MM'/'dd");
    assert.equal(momentToDotNetFormat('DD.MM.YY'), "dd'.'MM'.'yy");
    assert.equal(momentToDotNetFormat('HH:mm:ss.SSS'), "HH':'mm':'ss'.'fff");
    assert.equal(momentToDotNetFormat('dddd, MMMM D h:mm A'), "dddd', 'MMMM' 'd' 'h':'mm' 'tt");
  });

  it('prefixes a lone single-letter token with %', () => {
    assert.equal(momentToDotNetFormat('D'), '%d');
    assert.equal(momentToDotNetFormat('H'), '%H');
  });

  it('keeps bracketed text and quotes as literals', () => {
    assert.equal(momentToDotNetFormat('[Today is] dddd'), "'Today is 'dddd");
    assert.equal(momentToDotNetFormat("[it's] YYYY"), "'it'\\''s 'yyyy");
  });
});
