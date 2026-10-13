import assert from 'node:assert/strict';
import {after, before, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession, resetCalculator} from './helpers/session.js';

describe('windows: getMonitors extension command', () => {
  let calc: Browser;

  before(async () => {
    calc = await createCalculatorSession();
  });

  after(async () => {
    await quitSession(calc);
  });

  beforeEach(async () => {
    await resetCalculator(calc);
  });

  describe('getMonitors — response shape', () => {
    it('returns a non-empty array', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      assert.equal(Array.isArray(monitors), true);
      assert.ok(monitors.length >= 1);
    });

    it('each monitor has required numeric index and non-empty deviceName', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      for (const monitor of monitors) {
        assert.equal(typeof monitor.index, 'number');
        assert.equal(typeof monitor.deviceName, 'string');
        assert.ok(monitor.deviceName.length > 0);
      }
    });

    it('each monitor has a boolean primary field', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      for (const monitor of monitors) {
        assert.equal(typeof monitor.primary, 'boolean');
      }
    });

    it('exactly one monitor is marked as primary', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      const primaries = monitors.filter((m: any) => m.primary);
      assert.equal(primaries.length, 1);
    });

    it('each monitor has bounds with positive width and height', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      for (const monitor of monitors) {
        assert.equal(typeof monitor.bounds.x, 'number');
        assert.equal(typeof monitor.bounds.y, 'number');
        assert.ok(monitor.bounds.width > 0);
        assert.ok(monitor.bounds.height > 0);
      }
    });

    it('each monitor has workingArea with positive width and height', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      for (const monitor of monitors) {
        assert.equal(typeof monitor.workingArea.x, 'number');
        assert.equal(typeof monitor.workingArea.y, 'number');
        assert.ok(monitor.workingArea.width > 0);
        assert.ok(monitor.workingArea.height > 0);
      }
    });

    it('workingArea is contained within bounds for each monitor', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      for (const monitor of monitors) {
        assert.ok(monitor.workingArea.x >= monitor.bounds.x);
        assert.ok(monitor.workingArea.y >= monitor.bounds.y);
        assert.ok(monitor.workingArea.width <= monitor.bounds.width);
        assert.ok(monitor.workingArea.height <= monitor.bounds.height);
      }
    });

    it('monitor indices are sequential starting from 0', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      const indices = monitors.map((m: any) => m.index).sort((a: number, b: number) => a - b);
      for (let i = 0; i < indices.length; i++) {
        assert.equal(indices[i], i);
      }
    });

    it('primary monitor bounds origin is at the Windows virtual origin (0, 0)', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      const primary = monitors.find((m: any) => m.primary);
      assert.equal(primary.bounds.x, 0);
      assert.equal(primary.bounds.y, 0);
    });
  });

  describe('virtual-screen absolute click regression', () => {
    it('clicking Calculator "9" button by absolute screen coordinates shows 9 in display', async () => {
      const btn = await calc.$('~num9Button');
      const loc = await btn.getLocation();
      const size = await btn.getSize();
      const windowRect = await calc.getWindowRect();

      const x = Math.round(windowRect.x + loc.x + size.width / 2);
      const y = Math.round(windowRect.y + loc.y + size.height / 2);

      await calc.executeScript('windows: click', [{x, y}]);

      const display = await calc.$('~CalculatorResults');
      assert.ok((await display.getText()).includes('9'));
    });

    it('clicking Calculator "5" button by absolute screen coordinates shows 5 in display', async () => {
      const btn = await calc.$('~num5Button');
      const loc = await btn.getLocation();
      const size = await btn.getSize();
      const windowRect = await calc.getWindowRect();

      const x = Math.round(windowRect.x + loc.x + size.width / 2);
      const y = Math.round(windowRect.y + loc.y + size.height / 2);

      await calc.executeScript('windows: click', [{x, y}]);

      const display = await calc.$('~CalculatorResults');
      assert.ok((await display.getText()).includes('5'));
    });

    it('absolute coordinates derived from getMonitors primary bounds contain the Calculator window', async () => {
      const monitors = (await calc.executeScript('windows: getMonitors', [])) as any[];
      const primary = monitors.find((m: any) => m.primary);
      const windowRect = await calc.getWindowRect();

      // Maximized windows on Windows report rect with ~8 px negative inset (invisible
      // drop-shadow border), so allow a small tolerance.
      const TOLERANCE = 16;

      // Calculator window should fall within primary monitor bounds
      // (it was launched without any monitor preference, so it opens on primary)
      assert.ok(windowRect.x >= primary.bounds.x - TOLERANCE);
      assert.ok(windowRect.y >= primary.bounds.y - TOLERANCE);
      assert.ok(windowRect.x + windowRect.width <= primary.bounds.x + primary.bounds.width + TOLERANCE);
      assert.ok(windowRect.y + windowRect.height <= primary.bounds.y + primary.bounds.height + TOLERANCE);
    });
  });
});
