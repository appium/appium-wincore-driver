/**
 * E2E tests for the IE DOM Bridge.
 *
 * The driver attaches to a running iexplore.exe process via WM_HTML_GETOBJECT,
 * retrieves IHTMLDocument2 via COM, and routes all element commands through a
 * 32-bit C# bridge process over stdio JSON.
 *
 * Supported locator strategies: id, css selector, xpath
 * Target site: https://the-internet.herokuapp.com
 *
 * Requirements:
 *   - Appium running on localhost:4723 with appium-wincore-driver installed
 *   - Internet Explorer 11 at C:\Program Files\Internet Explorer\iexplore.exe
 */
import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {
  createIEBridgeSession,
  createIEBridgeAttachSession,
  launchIEExternally,
  quitSession,
} from './helpers/session.js';

const BASE_URL = 'https://the-internet.herokuapp.com';

// ── Launch via app capability ─────────────────────────────────────────────────

describe('IE bridge — launch via app capability', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/login`);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('getTitle returns non-empty string', async () => {
    const title = await driver.getTitle();
    assert.equal(typeof title, 'string');
    assert.ok(title.length > 0);
  });

  it('getUrl returns the navigated URL', async () => {
    const url = await driver.getUrl();
    assert.ok(url.includes('the-internet.herokuapp.com'));
  });

  it('getPageSource returns HTML containing known elements', async () => {
    const source = await driver.getPageSource();
    assert.equal(typeof source, 'string');
    assert.ok(source.toLowerCase().includes('<html'));
    assert.ok(source.includes('username'));
    assert.ok(source.includes('password'));
  });
});

// ── Attach to existing IE window ──────────────────────────────────────────────

describe('IE bridge — attach to existing IE window', () => {
  let driver: Browser;

  before(async () => {
    // Launch IE externally, get its HWND, then attach without taking ownership
    const {hwnd} = await launchIEExternally(`${BASE_URL}/login`);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    driver = await createIEBridgeAttachSession(hwnd);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('getTitle works after attaching to existing window', async () => {
    const title = await driver.getTitle();
    assert.equal(typeof title, 'string');
    assert.ok(title.length > 0);
  });

  it('getUrl returns URL of existing window', async () => {
    const url = await driver.getUrl();
    assert.ok(url.includes('the-internet.herokuapp.com'));
  });

  it('can find elements in the attached window', async () => {
    const el = await driver.$('#username');
    assert.equal(await el.isExisting(), true);
  });
});

// ── Locator strategies ────────────────────────────────────────────────────────

describe('IE bridge — locator strategies — /login', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/login`);
  });

  after(async () => {
    await quitSession(driver);
  });

  describe('id', () => {
    it('findElement by id returns element', async () => {
      const el = await driver.findElement('id', 'username');
      assert.notEqual(el, undefined);
    });

    it('findElements by id returns array', async () => {
      const els = await driver.findElements('id', 'username');
      assert.equal(Array.isArray(els), true);
      assert.equal(els.length, 1);
    });
  });

  describe('css selector', () => {
    it('findElement by css selector — simple id selector', async () => {
      const el = await driver.$('#username');
      assert.equal(await el.isExisting(), true);
    });

    it('findElement by css selector — attribute selector', async () => {
      const el = await driver.$('input[type="password"]');
      assert.equal(await el.isExisting(), true);
    });

    it('findElement by css selector — class selector', async () => {
      const el = await driver.$('button.radius');
      assert.equal(await el.isExisting(), true);
    });

    it('findElements by css selector returns all matches', async () => {
      const inputs = await driver.$$('input').getElements();
      assert.equal(Array.isArray(inputs), true);
      assert.ok(inputs.length >= 2);
    });

    // Regression: some legacy IE document/compat modes hide querySelectorAll
    // from the page's own script engine even though querySelector (single)
    // and the COM-level document object still expose it. findElements with
    // an attribute selector previously surfaced an opaque SCRIPT_E_REPORTED
    // (0x80020101) with no diagnostic message in that scenario.
    it('findElements by css selector — attribute selector returns matches', async () => {
      const inputs = await driver.findElements('css selector', 'input[type="password"]');
      assert.equal(Array.isArray(inputs), true);
      assert.equal(inputs.length, 1);
    });

    it('findElement with no match returns isExisting false', async () => {
      await driver.setTimeout({implicit: 500});
      const el = await driver.$('#does-not-exist-xyz');
      assert.equal(await el.isExisting(), false);
      await driver.setTimeout({implicit: 5000});
    });
  });

  describe('xpath', () => {
    it('findElement by xpath — attribute predicate', async () => {
      const el = await driver.$('//input[@id="username"]');
      assert.equal(await el.isExisting(), true);
    });

    it('findElement by xpath — text content', async () => {
      const el = await driver.$('//button[contains(text(),"Login")]');
      assert.equal(await el.isExisting(), true);
    });

    it('findElements by xpath returns array', async () => {
      const inputs = await driver.$$('//input').getElements();
      assert.equal(Array.isArray(inputs), true);
      assert.ok(inputs.length >= 2);
    });
  });
});

// ── Element interactions ──────────────────────────────────────────────────────

describe('IE bridge — element interactions — /login', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/login`);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('getText returns visible text', async () => {
    const btn = await driver.$('button[type="submit"]');
    const text = await btn.getText();
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
  });

  it('getAttribute returns the requested attribute', async () => {
    const el = await driver.$('#username');
    assert.equal(await el.getAttribute('type'), 'text');
  });

  it('isDisplayed returns true for visible element', async () => {
    assert.equal(await driver.$('#username').isDisplayed(), true);
  });

  it('isEnabled returns true for enabled input', async () => {
    assert.equal(await driver.$('#username').isEnabled(), true);
  });

  it('setValue types into username field', async () => {
    const el = await driver.$('#username');
    await el.setValue('tomsmith');
    assert.equal(await el.getValue(), 'tomsmith');
  });

  it('clearValue empties the field', async () => {
    const el = await driver.$('#username');
    await el.setValue('tomsmith');
    await el.clearValue();
    assert.equal(await el.getValue(), '');
  });

  it('click on submit navigates away from login', async () => {
    await driver.$('#username').setValue('tomsmith');
    await driver.$('#password').setValue('SuperSecretPassword!');
    await driver.$('button[type="submit"]').click();
    await driver.pause(2000);
    const url = await driver.getUrl();
    assert.ok(!url.includes('/login'));
  });
});

// ── Checkboxes (isSelected) ───────────────────────────────────────────────────

describe('IE bridge — checkboxes — /checkboxes', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/checkboxes`);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('isSelected returns boolean for checkbox', async () => {
    const boxes = await driver.$$('input[type="checkbox"]').getElements();
    assert.equal(typeof (await boxes[0].isSelected()), 'boolean');
  });

  it('click toggles checkbox isSelected state', async () => {
    const boxes = await driver.$$('input[type="checkbox"]').getElements();
    const wasSelected = await boxes[0].isSelected();
    await boxes[0].click();
    await driver.pause(300);
    assert.equal(await boxes[0].isSelected(), !wasSelected);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('IE bridge — navigation', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/login`);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('url() navigates and getUrl reflects the new page', async () => {
    await driver.url(`${BASE_URL}/checkboxes`);
    await driver.pause(2000);
    assert.ok((await driver.getUrl()).includes('/checkboxes'));
  });

  it('getTitle updates after navigation', async () => {
    await driver.url(`${BASE_URL}/login`);
    await driver.pause(2000);
    const title = await driver.getTitle();
    assert.ok(title.length > 0);
  });
});

// ── frame switching ─────────────────────────────────────────────────────────
// Uses /nested_frames, not /iframe — TinyMCE's iframe depends on cdn.tiny.cloud,
// unreachable from this VM.

describe('IE bridge — switchToFrame / switchToDefaultContent', () => {
  let driver: Browser;

  before(async () => {
    driver = await createIEBridgeSession(`${BASE_URL}/nested_frames`);
    await driver.pause(2000);
  });

  after(async () => {
    await quitSession(driver);
  });

  it('switchFrame(0) scopes finds to the first frame (frame-top)', async () => {
    await driver.switchFrame(0 as never);
    const nestedFrameset = await driver.$('//frameset');
    assert.equal(await nestedFrameset.isExisting(), true);
    await driver.switchFrame(null);
  });

  it("switchFrame by name scopes finds to that frame's content", async () => {
    const frameEl = await driver.$('//frame[@name="frame-bottom"]');
    assert.equal(await frameEl.isExisting(), true);
    await driver.switchFrame(frameEl);
    const body = await driver.$('//body');
    assert.equal(await body.isExisting(), true);
    assert.ok((await body.getText()).includes('BOTTOM'));
    await driver.switchFrame(null);
  });

  it('top-level elements are not reachable while inside a frame', async () => {
    const frameEl = await driver.$('//frame[@name="frame-bottom"]');
    await driver.switchFrame(frameEl);
    await driver.setTimeout({implicit: 500});
    const topFrameset = await driver.$('//frameset');
    assert.equal(await topFrameset.isExisting(), false);
    await driver.setTimeout({implicit: 5000});
    await driver.switchFrame(null);
  });

  it('switchFrame(null) restores access to the top-level document', async () => {
    const frameEl = await driver.$('//frame[@name="frame-bottom"]');
    await driver.switchFrame(frameEl);
    await driver.switchFrame(null);
    const topFrameset = await driver.$('//frameset');
    assert.equal(await topFrameset.isExisting(), true);
  });

  it('switching directly between two frames (no default-content in between) scopes correctly each time', async () => {
    const bottomEl = await driver.$('//frame[@name="frame-bottom"]');
    await driver.switchFrame(bottomEl);
    assert.ok((await (await driver.$('//body')).getText()).includes('BOTTOM'));
    await driver.switchFrame(null);

    const topEl = await driver.$('//frame[@name="frame-top"]');
    await driver.switchFrame(topEl);
    const nestedFrameset = await driver.$('//frameset');
    assert.equal(await nestedFrameset.isExisting(), true);
    await driver.switchFrame(null);
  });

  it('supports nested frame switching (frame-top -> frame-left)', async () => {
    const topEl = await driver.$('//frame[@name="frame-top"]');
    await driver.switchFrame(topEl);

    const leftEl = await driver.$('//frame[@name="frame-left"]');
    assert.equal(await leftEl.isExisting(), true);
    await driver.switchFrame(leftEl);

    const body = await driver.$('//body');
    assert.ok((await body.getText()).includes('LEFT'));

    await driver.switchFrame(null);
    const topFrameset = await driver.$('//frameset');
    assert.equal(await topFrameset.isExisting(), true);
  });

  it('repeated in/out cycles do not leak stale frame state', async () => {
    for (let i = 0; i < 2; i++) {
      const bottomEl = await driver.$('//frame[@name="frame-bottom"]');
      await driver.switchFrame(bottomEl);
      assert.ok((await (await driver.$('//body')).getText()).includes('BOTTOM'));
      await driver.switchFrame(null);
      const topFrameset = await driver.$('//frameset');
      assert.equal(await topFrameset.isExisting(), true);
    }
  });

  it('setValue and click work on elements inside a frame', async () => {
    const bottomEl = await driver.$('//frame[@name="frame-bottom"]');
    await driver.switchFrame(bottomEl);

    // /frame_bottom ships static text only — inject a real input + button so
    // setValue/click exercise the full element-interaction path inside a frame.
    await driver.execute(`
            var input = document.createElement('input');
            input.id = 'ieb-test-input';
            document.body.appendChild(input);
            var btn = document.createElement('button');
            btn.id = 'ieb-test-btn';
            btn.onclick = function () {
                btn.setAttribute('data-clicked', input.value);
            };
            document.body.appendChild(btn);
        `);

    const input = await driver.$('#ieb-test-input');
    await input.setValue('hello-frame');
    assert.equal(await input.getValue(), 'hello-frame');

    const btn = await driver.$('#ieb-test-btn');
    await btn.click();
    assert.equal(await btn.getAttribute('data-clicked'), 'hello-frame');

    await driver.switchFrame(null);
  });
});
