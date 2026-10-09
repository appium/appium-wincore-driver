import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession} from './helpers/session.js';

describe('Device and system commands', () => {
  let driver: Browser;

  before(async () => {
    driver = await createCalculatorSession();
  });

  after(async () => {
    await quitSession(driver);
  });

  describe('getDeviceTime', () => {
    it('returns an ISO 8601 timestamp string', async () => {
      const time = await driver.getDeviceTime();
      // yyyy-MM-ddTHH:mm:ss+HH:mm
      assert.match(time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    });

    it('windows: getDeviceTime with custom format returns formatted string', async () => {
      const year = (await driver.executeScript('windows: getDeviceTime', [{format: 'yyyy'}])) as string;
      assert.match(year, /^\d{4}$/);
      assert.ok(parseInt(year, 10) >= 2020);
    });
  });

  describe('getOrientation', () => {
    it('returns LANDSCAPE or PORTRAIT', async () => {
      const orientation = await driver.getOrientation();
      assert.ok(['LANDSCAPE', 'PORTRAIT'].includes(orientation));
    });

    it('returns the same value on repeated calls', async () => {
      const first = await driver.getOrientation();
      const second = await driver.getOrientation();
      assert.equal(first, second);
    });
  });
});
