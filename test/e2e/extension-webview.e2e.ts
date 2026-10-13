/**
 * E2E tests for WebView/CDP context switching.
 *
 * Uses Chrome launched with --remote-debugging-port to expose a CDP endpoint.
 * Requires Chrome installed at the default path on the test machine.
 */
import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {quitSession, closeAllTestApps, createChromeWebviewSession} from './helpers/session.js';

type WebviewContext = {id: string; title?: string; url?: string};

/** All WEBVIEW_ contexts; Chrome also lists non-page targets such as extension background pages. */
async function getWebviews(driver: Browser): Promise<WebviewContext[]> {
  const contexts = (await driver.execute('mobile: getContexts', [{}])) as unknown as WebviewContext[];
  return contexts.filter((c) => c.id.startsWith('WEBVIEW_'));
}

/** The WEBVIEW_ context showing the local fixture page; throws if none found. */
async function getFixtureWebviewId(driver: Browser): Promise<string> {
  const webview = (await getWebviews(driver)).find((c) => c.url?.includes('webview.html'));
  if (!webview) {
    throw new Error('No WEBVIEW_ context for the fixture page found');
  }
  return webview.id;
}

/** Switch to the fixture page's WEBVIEW_ context. */
async function switchToFixtureWebview(driver: Browser): Promise<string> {
  const webviewId = await getFixtureWebviewId(driver);
  await driver.switchContext(webviewId);
  return webviewId;
}

describe('Chrome WebView context support', () => {
  let driver: Browser;

  beforeEach(async () => {
    closeAllTestApps();
    driver = await createChromeWebviewSession();
    // Give Chrome time to finish loading the page
    await driver.pause(3000);
  });

  afterEach(async () => {
    await quitSession(driver);
  });

  it('getCurrentContext returns NATIVE_APP initially', async () => {
    const ctx = await driver.getContext();
    assert.equal(ctx, 'NATIVE_APP');
  });

  it('getContexts includes NATIVE_APP and at least one WEBVIEW_ entry', async () => {
    const contexts = (await driver.execute('mobile: getContexts', [{}])) as unknown as Array<{
      id: string;
      title?: string;
      url?: string;
    }>;
    const ids = contexts.map((c) => c.id);

    assert.ok(ids.includes('NATIVE_APP'));
    assert.equal(
      ids.some((id) => id.startsWith('WEBVIEW_')),
      true,
    );
  });

  it('mobile:getContexts returns title and url metadata for webview pages', async () => {
    const webviews = await getWebviews(driver);

    assert.ok(webviews.length > 0);
    for (const webview of webviews) {
      assert.equal(typeof webview.title, 'string');
      assert.equal(typeof webview.url, 'string');
    }
    assert.equal(
      webviews.some((c) => c.url?.includes('webview.html')),
      true,
    );
  });

  it('switches to Chrome webview context and executes JavaScript', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);
    assert.equal(await driver.getContext(), webviewId);

    const title = (await driver.execute('return document.title')) as unknown as string;
    assert.equal(typeof title, 'string');
    assert.ok(title.length > 0);

    const url = (await driver.execute('return window.location.href')) as unknown as string;
    assert.ok(url.includes('webview.html'));
  });

  it('finds element by CSS selector inside Chrome webview', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);

    const h1 = await driver.$('h1');
    assert.equal(await h1.isExisting(), true);
    assert.equal(await h1.getText(), 'Wincore WebView Fixture');
  });

  it('finds element by XPath inside Chrome webview', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);

    const h1 = await driver.$('//h1');
    assert.equal(await h1.isExisting(), true);
    assert.equal(await h1.getText(), 'Wincore WebView Fixture');
  });

  it('can interact with elements inside Chrome webview', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);

    const body = await driver.$('body');
    await body.click();
    assert.equal(await body.isDisplayed(), true);
  });

  it('switches back to NATIVE_APP after entering webview context', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);
    await driver.switchContext('NATIVE_APP');

    assert.equal(await driver.getContext(), 'NATIVE_APP');
  });

  it('executes JS mutation inside webview and reads it back', async () => {
    const webviewId = await getFixtureWebviewId(driver);

    await driver.switchContext(webviewId);

    await driver.execute("document.body.setAttribute('data-test', 'appium-webview2')");
    const attr = (await driver.execute("return document.body.getAttribute('data-test')")) as unknown as string;
    assert.equal(attr, 'appium-webview2');
  });

  it('windows: execute commands work in webview context (routed to UIA, not Chromedriver)', async () => {
    await switchToFixtureWebview(driver);

    // windows:getDeviceTime is in CHROMEDRIVER_NO_PROXY — must still reach UIA handler
    const time = (await driver.execute('windows: getDeviceTime', {})) as unknown as string;
    assert.equal(typeof time, 'string');
    assert.ok(time.length > 0);
  });

  it('powerShell script still works in webview context', async () => {
    await switchToFixtureWebview(driver);

    const result = (await driver.executeScript('powerShell', [{script: 'Write-Output "hello"'}])) as unknown as string;
    assert.equal(result.trim(), 'hello');
  });

  it('explicit webviewDevtoolsPort cap works', async () => {
    await quitSession(driver);
    closeAllTestApps();

    driver = await createChromeWebviewSession({'appium:webviewDevtoolsPort': 10950});
    await driver.pause(3000);

    const contexts = (await driver.execute('mobile: getContexts', [{}])) as unknown as Array<{id: string}>;
    assert.equal(
      contexts.some((c) => c.id.startsWith('WEBVIEW_')),
      true,
    );
  });

  it('setContext throws for unknown context name', async () => {
    await assert.rejects(driver.switchContext('WEBVIEW_doesnotexist'));
  });

  it('switching between two webview sessions tears down previous Chromedriver', async () => {
    const contexts = (await driver.execute('mobile: getContexts', [{}])) as unknown as Array<{id: string}>;
    const webviewIds = contexts.filter((c) => c.id.startsWith('WEBVIEW_')).map((c) => c.id);

    if (webviewIds.length >= 2) {
      await driver.switchContext(webviewIds[0]);
      assert.equal(await driver.getContext(), webviewIds[0]);
      // Switch to second page — previous Chromedriver must be stopped, new one started
      await driver.switchContext(webviewIds[1]);
      assert.equal(await driver.getContext(), webviewIds[1]);
    } else {
      // Only one page: switch away and back — exercises stop+restart path
      await driver.switchContext(webviewIds[0]);
      await driver.switchContext('NATIVE_APP');
      await driver.switchContext(webviewIds[0]);
      assert.equal(await driver.getContext(), webviewIds[0]);
    }

    await driver.switchContext('NATIVE_APP');
    assert.equal(await driver.getContext(), 'NATIVE_APP');
  });
});

describe('WebView disabled (webviewEnabled: false)', () => {
  let driver: Browser;

  beforeEach(async () => {
    closeAllTestApps();
    driver = await createChromeWebviewSession({'appium:webviewEnabled': false});
    await driver.pause(1000);
  });

  afterEach(async () => {
    await quitSession(driver);
  });

  it('getContexts throws with clear error when webviewEnabled is false', async () => {
    await assert.rejects(driver.execute('mobile: getContexts', [{}]), /webviewEnabled/i);
  });

  it('getContext returns NATIVE_APP even when webviewEnabled is false', async () => {
    const ctx = await driver.getContext();
    assert.equal(ctx, 'NATIVE_APP');
  });
});
