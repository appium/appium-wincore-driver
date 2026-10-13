import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createWpfLargeSession, quitSession} from '../e2e/helpers/session.js';
import {finalizeRun, measure, type OpResult} from './helpers/bench.js';

const NODE_COUNT = Number(process.env.PERF_NODE_COUNT || 1500);
const SUITE = 'uia';

/**
 * Plain-UIA tree-walk benchmark against the wpf-large fixture. WPF exposes a native
 * UIA provider (AutomationPeer), so this measures the real cost of the COM tree walk
 * (getPageSource / XPath materialisation) without the MSAA->UIA bridge tax that
 * WinForms carries — benchmarking the protocol, not the bridge. Each perf fixture
 * feeds exactly one suite; winforms-large is the .NET-bridge suite's fixture.
 * Perf counters here are per-node COM-walk timings (`uia.pageSource.node`,
 * `uia.xpathModel.node`), not RPCs.
 *
 * Needs a running Appium server with this driver and wpf-large built
 * in ../appium-wincore-test-apps. Records to test/perf/results/, fails only on a >3x
 * regression vs test/perf/baselines/uia.json.
 */
describe('plain UIA page source / tree walk perf', () => {
  let driver: Browser;
  const results: OpResult[] = [];

  before(
    async () => {
      driver = await createWpfLargeSession(NODE_COUNT, {'appium:perfMetrics': true});
      await new Promise((resolve) => setTimeout(resolve, 2000));
    },
    {timeout: 120_000},
  );

  after(async () => {
    try {
      finalizeRun(SUITE, results);
    } finally {
      await quitSession(driver);
    }
  });

  it('measures getPageSource', async () => {
    const r = await measure(driver, 'getPageSource', NODE_COUNT, async () => await driver.getPageSource());
    results.push(r);
    assert.ok(r.p50Ms > 0);
  });

  it('measures full-tree //* findElements', async () => {
    const r = await measure(driver, 'findAll-star', NODE_COUNT, async () => await driver.$$('//*'));
    results.push(r);
    assert.ok(r.p50Ms > 0);
  });

  it('measures a deep single-element XPath find', async () => {
    const r = await measure(
      driver,
      'find-anchorLast',
      NODE_COUNT,
      async () => await driver.$('//*[@Name="perfAnchorLast"]').getAttribute('Name'),
    );
    results.push(r);
    assert.ok(r.p50Ms > 0);
  });

  it('measures bulk getAttribute over 50 elements', async () => {
    const fields = (await driver.$$('//Text')) as unknown as WebdriverIO.Element[];
    const slice = fields.slice(0, 50);
    const r = await measure(driver, 'getAttribute-x50', NODE_COUNT, async () => {
      for (const el of slice) {
        await el.getAttribute('Name');
      }
    });
    results.push(r);
    assert.ok(r.p50Ms > 0);
  });
});
