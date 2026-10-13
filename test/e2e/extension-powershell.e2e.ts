import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession} from './helpers/session.js';

describe('windows: powerShell and executePowerShellScript', () => {
  describe('powerShell script execution (isolatedScriptExecution: false)', () => {
    let driver: Browser;

    before(async () => {
      driver = await createCalculatorSession({'appium:isolatedScriptExecution': false});
    });

    after(async () => {
      await quitSession(driver);
    });

    it('executes a simple Get-Date command and returns non-empty output', async () => {
      const result = (await driver.executeScript('powerShell', [{script: 'Get-Date'}])) as string;
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    });

    it('executes a multi-line script and returns final output', async () => {
      const result = (await driver.executeScript('powerShell', [
        {
          script: '$a = 1 + 1\n$a',
        },
      ])) as string;
      assert.equal(result.trim(), '2');
    });

    it('returns empty string for a script with no output', async () => {
      const result = (await driver.executeScript('powerShell', [{script: '$null | Out-Null'}])) as string;
      assert.equal(result.trim(), '');
    });

    it('accepts an object with a script property', async () => {
      const result = (await driver.executeScript('powerShell', [{script: '"script-prop-test"'}])) as string;
      assert.equal(result.trim(), 'script-prop-test');
    });

    it('accepts an object with a command property', async () => {
      const result = (await driver.executeScript('powerShell', [{command: '"command-prop-test"'}])) as string;
      assert.equal(result.trim(), 'command-prop-test');
    });

    it('executes powerShell alias', async () => {
      const result = (await driver.executeScript('powerShell', [
        {
          script: '"alias-test"',
        },
      ])) as string;
      assert.equal(result.trim(), 'alias-test');
    });
  });

  describe('powerShell script execution (isolatedScriptExecution: true)', () => {
    let driver: Browser;

    before(async () => {
      driver = await createCalculatorSession({'appium:isolatedScriptExecution': true});
    });

    after(async () => {
      await quitSession(driver);
    });

    it('executes a script in isolated mode and returns output', async () => {
      const result = (await driver.executeScript('powerShell', [
        {script: 'Get-Process | Select-Object -First 1 | Select-Object -ExpandProperty Name'},
      ])) as string;
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    });

    it('variables do NOT persist between isolated powerShell calls', async () => {
      await driver.executeScript('powerShell', [{script: '$isolatedVar = "should-not-persist"'}]);
      const result = (await driver.executeScript('powerShell', [{script: '$isolatedVar'}])) as string;
      // In isolated mode each execution is fresh — variable is not defined
      assert.equal(result.trim(), '');
    });
  });
});
