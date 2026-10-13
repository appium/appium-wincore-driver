/**
 * Regression coverage for boolean UIA attributes (`IsEnabled`, `IsOffscreen`, ...) in
 * both `getPageSource` and the XPath engine.
 *
 * `PageSourceCommands.CBool` and `XPathCommands.ReadCached`/`ReadLive` read these via
 * `GetCachedPropertyValue`/`GetCurrentPropertyValue(pid)` and test `value is int`. UIA
 * hands VT_BOOL properties back as a boxed `bool`, not `int` (see
 * `ElementCommands.cs` `getProperty`, which normalises `bool b => b` before
 * `int i => i`), so that check is always false and every boolean attribute renders as
 * "False"/"false" regardless of the element's real state. The deleted typed accessors
 * (`element.CurrentIsEnabled != 0`) were correct.
 *
 * Target: Windows Calculator's `num1Button`, which is always enabled and always
 * on-screen once the app is open — a stable "known true/false" fixture.
 */
import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession} from './helpers/session.js';

describe('boolean UIA attributes (IsEnabled/IsOffscreen) reflect real element state', () => {
  let driver: Browser;

  before(async () => {
    driver = await createCalculatorSession();
    await driver.$('~num1Button').waitForExist({timeout: 15_000});
  });

  after(async () => {
    await quitSession(driver);
  });

  it('getPageSource reports IsEnabled="True" for an enabled, on-screen button', async () => {
    const source = await driver.getPageSource();
    const match = source.match(/AutomationId="num1Button"[^>]*/);
    assert.notEqual(match, null);
    const tag = match![0];
    assert.match(tag, /IsEnabled="True"/);
    assert.match(tag, /IsOffscreen="False"/);
  });

  it('XPath finds an element by a true boolean attribute', async () => {
    const el = await driver.$('//Button[@AutomationId="num1Button" and @IsEnabled="true"]');
    assert.equal(await el.isExisting(), true);
  });

  it('XPath excludes it when the boolean attribute is asserted false', async () => {
    const els = await driver.$$('//Button[@AutomationId="num1Button" and @IsEnabled="false"]').getElements();
    assert.equal(els.length, 0);
  });
});
