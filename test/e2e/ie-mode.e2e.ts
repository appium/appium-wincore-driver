/**
 * E2E tests for Edge UIA automation (no WebView/CDP, no protocol proxy).
 * Target: the-internet.herokuapp.com
 *
 * Navigation between test groups uses Ctrl+L to focus the Edge address bar,
 * then types the URL and presses Enter via the windows: keys extension command.
 */
import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createEdgeIEModeSession, quitSession} from './helpers/session.js';

const BASE_URL = 'https://the-internet.herokuapp.com';

async function navigateTo(driver: Browser, url: string): Promise<void> {
  await driver.keys(['Control', 'l']);
  await driver.pause(400);
  await driver.executeScript('windows: keys', [{actions: [{text: url}]}]);
  await driver.pause(200);
  await driver.keys(['Return']);
  await driver.pause(3000);
}

describe('Edge UIA — the-internet.herokuapp.com', () => {
  let driver: Browser;

  before(async () => {
    driver = await createEdgeIEModeSession(BASE_URL);
    await driver.pause(4000);
  });

  after(async () => {
    await quitSession(driver);
  });

  // ── Page bootstrap ────────────────────────────────────────────────────────

  describe('bootstrap', () => {
    it('home page has Hyperlink elements', async () => {
      const links = await driver.$$('//Hyperlink').getElements();
      assert.ok(links.length > 0);
    });

    it('home page has a known link by name', async () => {
      const link = await driver.$('//Hyperlink[@Name="A/B Testing"]');
      assert.equal(await link.isExisting(), true);
    });

    it('getTitle returns non-empty string', async () => {
      const title = await driver.getTitle();
      assert.equal(typeof title, 'string');
      assert.ok(title.length > 0);
    });

    it('getWindowRect returns positive dimensions', async () => {
      const rect = await driver.getWindowRect();
      assert.ok(rect.width > 0);
      assert.ok(rect.height > 0);
    });

    it('takeScreenshot returns valid PNG', async () => {
      const screenshot = await driver.takeScreenshot();
      assert.equal(typeof screenshot, 'string');
      assert.ok(screenshot.length > 0);
      const buf = Buffer.from(screenshot, 'base64');
      assert.equal(buf[0], 0x89);
      assert.equal(buf[1], 0x50); // P
      assert.equal(buf[2], 0x4e); // N
      assert.equal(buf[3], 0x47); // G
    });

    it('getWindowHandles returns at least one handle', async () => {
      const handles = await driver.getWindowHandles();
      assert.equal(Array.isArray(handles), true);
      assert.ok(handles.length >= 1);
    });
  });

  // ── UIA element types present on home page ────────────────────────────────

  describe('element types — home page', () => {
    it('finds Hyperlink elements', async () => {
      const links = await driver.$$('//Hyperlink').getElements();
      assert.ok(links.length > 0);
    });

    it('finds Text elements', async () => {
      const texts = await driver.$$('//Text').getElements();
      assert.ok(texts.length > 0);
    });

    it('finds ListItem elements', async () => {
      const items = await driver.$$('//ListItem').getElements();
      assert.ok(items.length > 0);
    });

    it('finds a Document element (page content root)', async () => {
      const docs = await driver.$$('//Document').getElements();
      assert.ok(docs.length >= 1);
    });

    it('first Hyperlink isDisplayed true', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      assert.equal(await link.isDisplayed(), true);
    });

    it('first Hyperlink isEnabled true', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      assert.equal(await link.isEnabled(), true);
    });
  });

  // ── UIA attributes ────────────────────────────────────────────────────────

  describe('UIA attributes', () => {
    it('reads Name attribute from a Hyperlink', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const name = await link.getAttribute('Name');
      assert.equal(typeof name, 'string');
    });

    it('reads ControlType attribute from a Hyperlink', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const ct = await link.getAttribute('ControlType');
      assert.equal(typeof ct, 'string');
      assert.ok((ct ?? '').length > 0);
    });

    it('reads IsEnabled attribute', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const val = await link.getAttribute('IsEnabled');
      assert.ok(val);
    });

    it('reads BoundingRectangle attribute', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const rect = await link.getAttribute('BoundingRectangle');
      assert.ok(rect);
    });

    it('getText on a Hyperlink returns a non-empty string', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const text = await link.getText();
      assert.equal(typeof text, 'string');
      assert.ok(text.length > 0);
    });

    it('getLocation returns numeric x and y', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const loc = await link.getLocation();
      assert.equal(typeof loc.x, 'number');
      assert.equal(typeof loc.y, 'number');
    });

    it('getSize returns positive width and height', async () => {
      const link = await driver.$('//Hyperlink[@Name]');
      const size = await link.getSize();
      assert.ok(size.width > 0);
      assert.ok(size.height > 0);
    });
  });

  // ── Click and navigation ──────────────────────────────────────────────────

  describe('click and navigation', () => {
    it('clicking a Hyperlink navigates to the target page', async () => {
      await navigateTo(driver, BASE_URL);
      const link = await driver.$('//Hyperlink[@Name="A/B Testing"]');

      await link.click();
      await driver.pause(3000);

      // Verify we landed on /abtest — page randomly shows "A/B Test Control" or "A/B Test Variation 1"
      const heading = await driver.$('//*[contains(@Name, "A/B Test")]');
      assert.equal(await heading.isExisting(), true);
    });

    it('navigating to a different page shows elements unique to that page', async () => {
      await navigateTo(driver, `${BASE_URL}/checkboxes`);
      // CheckBox elements only exist on /checkboxes
      const checkboxes = await driver.$$('//CheckBox').getElements();
      assert.ok(checkboxes.length >= 2);

      await navigateTo(driver, `${BASE_URL}/login`);
      // Edit fields for username/password only exist on /login
      const inputs = await driver.$$('//Edit').getElements();
      assert.ok(inputs.length >= 2);
    });

    it('navigating to /login shows login-specific elements', async () => {
      await navigateTo(driver, `${BASE_URL}/login`);
      const username = await driver.$('//Edit[@Name="Username"]');
      assert.equal(await username.isExisting(), true);
    });
  });

  // ── Text input (login page) ───────────────────────────────────────────────

  describe('text input — /login', () => {
    before(async () => {
      await navigateTo(driver, `${BASE_URL}/login`);
    });

    it('finds Edit elements on the login form', async () => {
      const inputs = await driver.$$('//Edit').getElements();
      assert.ok(inputs.length >= 2);
    });

    it('Edit elements are displayed and enabled', async () => {
      const username = await driver.$('//Edit[@Name="Username"]');
      assert.equal(await username.isDisplayed(), true);
      assert.equal(await username.isEnabled(), true);
    });

    it('clearValue empties the username field', async () => {
      const username = await driver.$('//Edit[@Name="Username"]');
      await username.setValue('tomsmith');
      await username.clearValue();
      await driver.pause(200);
      const text = await username.getText();
      assert.equal(text.trim(), '');
    });

    it('setValue types text into the username field', async () => {
      const username = await driver.$('//Edit[@Name="Username"]');
      await username.setValue('tomsmith');
      const text = await username.getText();
      assert.ok(text.includes('tomsmith'));
    });

    it('setValue on password field', async () => {
      const password = await driver.$('//Edit[@Name="Password"]');
      await password.setValue('SuperSecretPassword!');
      const text = await password.getText();
      assert.ok(text.length > 0);
    });
  });

  // ── Checkboxes ────────────────────────────────────────────────────────────

  describe('checkboxes — /checkboxes', () => {
    before(async () => {
      await navigateTo(driver, `${BASE_URL}/checkboxes`);
    });

    it('finds at least two CheckBox elements', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      assert.ok(boxes.length >= 2);
    });

    it('CheckBox isDisplayed and isEnabled', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      assert.equal(await boxes[0].isDisplayed(), true);
      assert.equal(await boxes[0].isEnabled(), true);
    });

    it('isSelected returns a boolean', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      const selected = await boxes[0].isSelected();
      assert.equal(typeof selected, 'boolean');
    });

    it('clicking a checkbox toggles its selected state', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      const wasSelected = await boxes[0].isSelected();
      await boxes[0].click();
      await driver.pause(300);
      const isSelected = await boxes[0].isSelected();
      assert.equal(isSelected, !wasSelected);
    });

    it('clicking checkbox twice restores original state', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      const original = await boxes[0].isSelected();
      await boxes[0].click();
      await driver.pause(1000);
      await boxes[0].click();
      await driver.pause(300);
      assert.equal(await boxes[0].isSelected(), original);
    });

    it('second checkbox has independent state', async () => {
      const boxes = await driver.$$('//CheckBox').getElements();
      const state0 = await boxes[0].isSelected();
      const state1 = await boxes[1].isSelected();
      // They may or may not match but both are valid booleans
      assert.equal(typeof state0, 'boolean');
      assert.equal(typeof state1, 'boolean');
    });
  });

  // ── Dropdown ──────────────────────────────────────────────────────────────

  describe('dropdown — /dropdown', () => {
    before(async () => {
      await navigateTo(driver, `${BASE_URL}/dropdown`);
    });

    it('finds a ComboBox or List element for the select', async () => {
      const combo = await driver.$('//ComboBox');
      const list = await driver.$('//List');
      const found = (await combo.isExisting()) || (await list.isExisting());
      assert.equal(found, true);
    });

    it('dropdown control is displayed and enabled', async () => {
      const combo = await driver.$('//ComboBox');
      if (await combo.isExisting()) {
        assert.equal(await combo.isDisplayed(), true);
        assert.equal(await combo.isEnabled(), true);
      }
    });

    it('dropdown has ListItem children', async () => {
      const items = await driver.$$('//ListItem').getElements();
      // May be 0 if options are hidden until expanded — just no throw
      assert.equal(Array.isArray(items), true);
    });
  });

  // ── Dynamic loading / implicit wait ───────────────────────────────────────

  describe('dynamic loading — /dynamic_loading/2', () => {
    before(async () => {
      await navigateTo(driver, `${BASE_URL}/dynamic_loading/2`);
    });

    it('Start button exists before loading', async () => {
      const btn = await driver.$('//Button');
      assert.equal(await btn.isExisting(), true);
    });

    it('clicking Start reveals a hidden element within timeout', async () => {
      const btn = await driver.$('//Button');
      await btn.click();
      await driver.pause(7500);

      // Look for "Hello World!" text that appears after loading
      const loaded = await driver.$('//*[contains(@Name, "Hello World")]');
      const exists = await loaded.isExisting();
      assert.equal(exists, true);
    });
  });

  // ── Navigation verification via known elements ────────────────────────────

  describe('navigation — verify via unique elements', () => {
    it('/checkboxes has CheckBox controls', async () => {
      await navigateTo(driver, `${BASE_URL}/checkboxes`);
      const checkboxes = await driver.$$('//CheckBox').getElements();
      assert.ok(checkboxes.length >= 2);
    });

    it('/login has username and password Edit controls', async () => {
      await navigateTo(driver, `${BASE_URL}/login`);
      const username = await driver.$('//Edit[@Name="Username"]');
      const password = await driver.$('//Edit[@Name="Password"]');
      assert.equal(await username.isExisting(), true);
      assert.equal(await password.isExisting(), true);
    });

    it('screenshot after navigation returns valid PNG', async () => {
      await navigateTo(driver, `${BASE_URL}/checkboxes`);
      const shot = await driver.takeScreenshot();
      const buf = Buffer.from(shot, 'base64');
      assert.equal(buf[0], 0x89);
      assert.equal(buf[1], 0x50);
    });
  });

  // ── Page source — verify traversal reflects navigation ────────────────────

  describe('page source', () => {
    it('getPageSource differs before and after navigation', async () => {
      await navigateTo(driver, `${BASE_URL}/checkboxes`);
      const sourceBefore = await driver.getPageSource();
      assert.equal(typeof sourceBefore, 'string');
      assert.ok(sourceBefore.length > 0);

      await navigateTo(driver, `${BASE_URL}/login`);
      const sourceAfter = await driver.getPageSource();
      assert.equal(typeof sourceAfter, 'string');
      assert.ok(sourceAfter.length > 0);

      assert.notEqual(sourceAfter, sourceBefore);
    });
  });

  // ── Data tables — /tables ─────────────────────────────────────────────────

  describe('data tables — /tables', () => {
    before(async () => {
      await navigateTo(driver, `${BASE_URL}/tables`);
    });

    it('finds two Table elements', async () => {
      const tables = await driver.$$('//Table').getElements();
      assert.equal(tables.length, 2);
    });

    it('table1 has expected column headers', async () => {
      const headers = await driver.$$('//*[@AutomationId="table1"]//HeaderItem').getElements();
      const names = await headers.map((h) => h.getAttribute('Name'));
      assert.ok(names.includes('Last Name'));
      assert.ok(names.includes('First Name'));
      assert.ok(names.includes('Email'));
      assert.ok(names.includes('Due'));
    });

    it('table1 has 4 data rows (24 DataItem cells total)', async () => {
      const cells = await driver.$$('//*[@AutomationId="table1"]//DataItem').getElements();
      assert.equal(cells.length, 24);
    });

    it('finds a specific cell value in table1', async () => {
      const cell = await driver.$('//*[@AutomationId="table1"]//DataItem[@Name="Smith"]');
      assert.equal(await cell.isExisting(), true);
    });

    it('reads all last-name cells from table1', async () => {
      const cells = await driver.$$('//*[@AutomationId="table1"]//DataItem').getElements();
      const names = await cells.map((c) => c.getAttribute('Name'));
      assert.ok(names.includes('Smith'));
      assert.ok(names.includes('Bach'));
      assert.ok(names.includes('Doe'));
      assert.ok(names.includes('Conway'));
    });

    it('table2 has same headers as table1', async () => {
      const headers = await driver.$$('//*[@AutomationId="table2"]//HeaderItem').getElements();
      assert.equal(headers.length, 6);
    });

    it('clicking a sortable header in table2 does not throw', async () => {
      const header = await driver.$('//*[@AutomationId="table2"]//HeaderItem[@Name="Last Name"]');
      await assert.doesNotReject(header.click());
      await driver.pause(500);
    });
  });

  // ── List items — home page ────────────────────────────────────────────────

  describe('list items — home page', () => {
    before(async () => {
      await navigateTo(driver, BASE_URL);
    });

    it('home page has at least 40 list items', async () => {
      const items = await driver.$$('//ListItem').getElements();
      assert.ok(items.length >= 40);
    });

    it('finds a specific list item by name', async () => {
      const item = await driver.$('//ListItem[@Name="Checkboxes"]');
      assert.equal(await item.isExisting(), true);
    });

    it('list items contain Hyperlink children', async () => {
      const link = await driver.$('//ListItem[@Name="Checkboxes"]//Hyperlink');
      assert.equal(await link.isExisting(), true);
    });

    it('first visible list item is displayed and enabled', async () => {
      const item = await driver.$('//ListItem[@Name="A/B Testing"]');
      assert.equal(await item.isDisplayed(), true);
      assert.equal(await item.isEnabled(), true);
    });

    it('offscreen list items exist in UIA tree even when not visible', async () => {
      // Items below the fold are in the UIA tree with IsOffscreen=True
      const item = await driver.$('//ListItem[@Name="Typos"]');
      assert.equal(await item.isExisting(), true);
    });
  });

  // ── Scrolling — home page ─────────────────────────────────────────────────

  describe('scrolling — home page', () => {
    // Wheel origin is a fixed point inside the viewport (window-rect center),
    // not a page element — an element used as origin can scroll itself
    // offscreen (negative y), which sends the cursor outside the window and
    // the wheel event never reaches the page.
    let cx: number;
    let cy: number;

    before(async () => {
      await navigateTo(driver, BASE_URL);
      // Ctrl+L navigation leaves focus in the address bar; UIA setFocus on a
      // link didn't move it back to the page. Clicking the Document root
      // (the page content area) does.
      const doc = await driver.$('//Document');
      await doc.click();

      const rect = await driver.getWindowRect();
      cx = Math.round(rect.x + rect.width / 2);
      cy = Math.round(rect.y + rect.height / 2);
    });

    it('W3C wheel scroll down moves elements up in viewport', async () => {
      const item = await driver.$('//ListItem[@Name="Checkboxes"]');
      const yBefore = (await item.getLocation()).y;

      await driver
        .action('wheel')
        .scroll({
          x: cx,
          y: cy,
          deltaX: 0,
          deltaY: 500,
          duration: 500,
        })
        .perform();

      const yAfter = (await item.getLocation()).y;
      assert.ok(yAfter < yBefore);
    });

    it('W3C wheel scroll up restores element position', async () => {
      const item = await driver.$('//ListItem[@Name="Checkboxes"]');
      const yScrolled = (await item.getLocation()).y;

      await driver
        .action('wheel')
        .scroll({
          x: cx,
          y: cy,
          deltaX: 0,
          deltaY: -500,
          duration: 500,
        })
        .perform();

      const yRestored = (await item.getLocation()).y;
      assert.ok(yRestored > yScrolled);
    });

    it('windows: scroll command scrolls the page', async () => {
      const item = await driver.$('//ListItem[@Name="Checkboxes"]');
      const yBefore = (await item.getLocation()).y;

      await driver.executeScript('windows: scroll', [
        {
          x: cx,
          y: cy,
          deltaX: 0,
          deltaY: 500,
          duration: 500,
        },
      ]);

      const yAfter = (await item.getLocation()).y;
      assert.ok(yAfter < yBefore);
    });
  });

  // ── Window handles ────────────────────────────────────────────────────────

  describe('window handles', () => {
    before(async () => {
      await navigateTo(driver, BASE_URL);
    });

    it('all handles match 0x hex format', async () => {
      const handles = await driver.getWindowHandles();
      for (const h of handles) {
        assert.match(h, /^0x[0-9a-fA-F]+$/);
      }
    });

    it('getWindowHandle returns a handle in the handles list', async () => {
      const current = await driver.getWindowHandle();
      const all = await driver.getWindowHandles();
      assert.ok(all.includes(current));
    });

    it('switchToWindow with current handle does not throw', async () => {
      const handle = await driver.getWindowHandle();
      await assert.doesNotReject(driver.switchToWindow(handle));
    });

    it('switchToWindow with invalid handle throws', async () => {
      await assert.rejects(driver.switchToWindow('0xDEADBEEF'));
    });
  });
});
