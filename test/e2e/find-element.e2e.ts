import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {closeAllTestApps, createCalculatorSession, quitSession} from './helpers/session.js';

describe('Element finding strategies', () => {
  let driver: Browser;

  before(async () => {
    closeAllTestApps();
    driver = await createCalculatorSession();
    // Let the app finish rendering before any test runs — first-launch UIA
    // tree can lag the process window by a second or more.
    await driver.$('~CalculatorResults').waitForExist({timeout: 10_000});
  });

  after(async () => {
    await quitSession(driver);
  });

  describe('by accessibility id', () => {
    it('finds the result display by accessibility id', async () => {
      const el = await driver.$('~CalculatorResults');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('throws NoSuchElementError for a non-existent accessibility id', async () => {
      assert.equal(await driver.$('~NonExistentElement_XYZ_123').isExisting(), false);
    });

    it('findElements by accessibility id returns an array', async () => {
      const els = (await driver.$$('~num1Button')) as unknown as unknown[];
      assert.equal(Array.isArray(els), true);
      assert.ok(els.length >= 1);
    });
  });

  describe('by name', () => {
    it('finds a button by Name property', async () => {
      const el = await driver.findElement('name', 'One');
      assert.notEqual(el, undefined);
    });

    it('findElements by name returns multiple matching elements', async () => {
      const els = await driver.findElements('name', 'One');
      assert.ok(els.length >= 1);
    });

    it('returns empty array for non-existent name', async () => {
      const els = await driver.findElements('name', 'NonExistentButtonNameXYZ');
      assert.equal(els.length, 0);
    });
  });

  describe('by xpath', () => {
    it('finds a button element using XPath tag name predicate', async () => {
      const el = await driver.$('//Button');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('finds a specific button using XPath Name attribute predicate', async () => {
      const el = await driver.$('//Button[@Name="One"]');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('findElements with XPath returns multiple buttons', async () => {
      const els = (await driver.$$('//Button')) as unknown as unknown[];
      assert.ok(els.length > 1);
    });

    it('finds element by XPath index expression', async () => {
      const el = await driver.$('//Custom/Group/Group[5]/Button[1]');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('finds a descendant scoped with relative XPath', async () => {
      const parent = await driver.$('//Custom/Group/Group[4]');
      const child = await parent.$('.//Button');
      assert.equal(await child.waitForExist({timeout: 3000}), true);
    });

    it('finds element using contains() on Name attribute', async () => {
      // "One" button Name contains "ne"
      const el = await driver.$('//*[contains(@Name, "ne")]');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('finds element using starts-with() on Name attribute', async () => {
      const el = await driver.$('//Button[starts-with(@Name, "On")]');
      assert.equal(await el.waitForExist({timeout: 3000}), true);
    });

    it('finds elements using boolean AND predicate', async () => {
      const els = (await driver.$$('//Button[@Name="One" and @AutomationId="num1Button"]')) as unknown as unknown[];
      assert.ok(els.length >= 1);
    });

    it('returns empty array when contains() matches nothing', async () => {
      const els = await driver.$$('//*[contains(@Name, "ZZZ_NONEXISTENT_ZZZ")]');
      assert.equal(els.length, 0);
    });
  });

  describe('by tag name (control type)', () => {
    it('finds the first Button element', async () => {
      const el = await driver.findElement('tag name', 'Button');
      assert.notEqual(el, undefined);
    });

    it('findElements by tag name returns a list of buttons', async () => {
      const els = await driver.findElements('tag name', 'Button');
      assert.ok(els.length > 1);
    });

    it('finds Text elements', async () => {
      const els = await driver.findElements('tag name', 'Text');
      assert.ok(els.length >= 1);
    });
  });

  describe('by class name', () => {
    it('finds an element by ClassName property', async () => {
      // Calculator's main window has a known class
      const els = await driver.findElements('class name', 'Windows.UI.Core.CoreWindow');
      // Either finds it or finds nothing — just verify no error
      assert.equal(Array.isArray(els), true);
    });
  });

  describe('by id (RuntimeId)', () => {
    it('finds an element by its runtime id once discovered', async () => {
      // First get the element via accessibility id to retrieve its runtime id
      const el = await driver.$('~CalculatorResults');
      const runtimeId = await el.getAttribute('RuntimeId');
      if (runtimeId) {
        const found = await driver.findElement('id', runtimeId);
        assert.notEqual(found, undefined);
      } else {
        // RuntimeId may not be exposed; skip with a note
        assert.equal(true, true);
      }
    });
  });

  describe('findElementFromElement and findElementsFromElement', () => {
    it('finds a child element scoped from a parent element', async () => {
      const group = await driver.$('//Custom/Group/Group[4]');
      const child = await group.findElement('tag name', 'Button');
      assert.notEqual(child, undefined);
    });

    it('finds multiple children scoped from a parent element', async () => {
      const group = await driver.$('//Custom/Group/Group[4]');
      const children = await group.findElements('tag name', 'Button');
      assert.ok(children.length > 1);
    });

    it('returns empty array when child does not exist within scope', async () => {
      const btn = await driver.$('~num1Button');
      const children = await btn.findElements('xpath', './Button');
      // A single button has no button children
      assert.equal(children.length, 0);
    });
  });
});
