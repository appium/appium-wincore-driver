import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {
  closeAllTestApps,
  createCalculatorSession,
  createNotepadSession,
  createRootSession,
  getNotepadTextArea,
  quitSession,
} from './helpers/session.js';

describe('Window and app management commands', () => {
  let calc: Browser;
  let root: Browser;
  let notepad: Browser;

  before(async () => {
    calc = await createCalculatorSession();
    notepad = await createNotepadSession();
    root = await createRootSession();
  });

  after(async () => {
    await quitSession(calc);
    await quitSession(notepad);
    await quitSession(root);
    closeAllTestApps();
  });

  describe('getWindowHandle', () => {
    it('returns a hex window handle string matching 0x format', async () => {
      const handle = await calc.getWindowHandle();
      assert.match(handle, /^0x[0-9a-fA-F]+$/);
    });

    it('returns the same handle on repeated calls', async () => {
      const first = await calc.getWindowHandle();
      const second = await calc.getWindowHandle();
      assert.equal(first, second);
    });
  });

  describe('getWindowHandles', () => {
    it('(app session) returns an array of at least one handle', async () => {
      const handles = await calc.getWindowHandles();
      assert.equal(Array.isArray(handles), true);
      assert.ok(handles.length >= 1);
    });

    it('(app session) all returned handles match the 0x hex format', async () => {
      const handles = await calc.getWindowHandles();
      for (const h of handles) {
        assert.match(h, /^0x[0-9a-fA-F]{8}$/);
      }
    });

    it('(root session) returns an array of at least one window handle', async () => {
      const handles = await root.getWindowHandles();
      assert.equal(Array.isArray(handles), true);
      assert.ok(handles.length >= 1);
    });
  });

  describe('getWindowRect', () => {
    it('returns a rect with positive width and height', async () => {
      const rect = await calc.getWindowRect();
      assert.ok(rect.width > 0);
      assert.ok(rect.height > 0);
    });

    it('returns numeric x and y coordinates', async () => {
      const rect = await calc.getWindowRect();
      assert.equal(typeof rect.x, 'number');
      assert.equal(typeof rect.y, 'number');
    });
  });

  describe('setWindow', () => {
    it('switches to a window by handle and getWindowHandle reflects it', async () => {
      const calcHandle = await calc.getWindowHandle();
      await calc.switchToWindow(calcHandle);
      const current = await calc.getWindowHandle();
      assert.equal(current, calcHandle);
    });

    it('throws NoSuchWindowError for an unknown handle', async () => {
      await assert.rejects(calc.switchToWindow('0xDEADBEEF'));
    });

    it('switches between two different windows and elements are accessible in each', async () => {
      const calcHandle = await calc.getWindowHandle();
      const notepadHandle = await notepad.getWindowHandle();

      await root.switchToWindow(calcHandle);
      const calcResults = await root.$('~CalculatorResults');
      assert.equal(await calcResults.isExisting(), true);

      await root.switchToWindow(notepadHandle);
      const notepadArea = await getNotepadTextArea(root);
      assert.equal(await notepadArea.isExisting(), true);

      await root.switchToWindow(calcHandle);
      const calcResultsAgain = await root.$('~CalculatorResults');
      assert.equal(await calcResultsAgain.isExisting(), true);
    });
  });

  describe('switchToWindowByTitle', () => {
    it('switches to a window by partial title (substring match)', async () => {
      await root.executeScript('windows: switchToWindowByTitle', [{title: 'Calculator'}]);
      const title = await root.getTitle();
      assert.ok(title.includes('Calculator'));
    });

    it('switches to a different window by partial title', async () => {
      await root.executeScript('windows: switchToWindowByTitle', [{title: 'Notepad'}]);
      const title = await root.getTitle();
      assert.ok(title.includes('Notepad'));
    });

    it('match is case-insensitive', async () => {
      await root.executeScript('windows: switchToWindowByTitle', [{title: 'calculator'}]);
      const title = await root.getTitle();
      assert.ok(title.includes('Calculator'));
    });

    it('switches back and elements are accessible in each window', async () => {
      await root.executeScript('windows: switchToWindowByTitle', [{title: 'Calculator'}]);
      const calcResults = await root.$('~CalculatorResults');
      assert.equal(await calcResults.isExisting(), true);

      await root.executeScript('windows: switchToWindowByTitle', [{title: 'Notepad'}]);
      const notepadArea = await getNotepadTextArea(root);
      assert.equal(await notepadArea.isExisting(), true);
    });

    it('exact match succeeds when title matches fully (case-insensitive)', async () => {
      const fullTitle = await calc.getTitle();
      await root.executeScript('windows: switchToWindowByTitle', [{title: fullTitle, exact: true}]);
      const current = await root.getTitle();
      assert.equal(current, fullTitle);
    });

    it('throws NoSuchWindowError for a title that matches nothing', async () => {
      await assert.rejects(root.executeScript('windows: switchToWindowByTitle', [{title: 'xXNonExistentWindowXx'}]));
    });
  });

  describe('windows: getWindows', () => {
    it('returns array of objects with handle, title, className fields', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      assert.equal(Array.isArray(windows), true);
      assert.ok(windows.length > 0);
      for (const w of windows) {
        assert.match(w.handle, /^0x[0-9a-fA-F]{8}$/);
        assert.equal(typeof w.title, 'string');
        assert.equal(typeof w.className, 'string');
      }
    });

    it('Calculator window appears with non-empty title and className', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      const calcWindow = windows.find((w) => w.title.toLowerCase().includes('calculator'));
      assert.notEqual(calcWindow, undefined);
      assert.ok(calcWindow!.className.length > 0);
    });

    it('Notepad window appears with non-empty title and className', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      const notepadWindow = windows.find((w) => w.title.toLowerCase().includes('notepad'));
      assert.notEqual(notepadWindow, undefined);
      assert.ok(notepadWindow!.className.length > 0);
    });

    it('switching to Calculator by handle from windows: getWindows gives access to CalculatorResults', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      const calcWindow = windows.find((w) => w.title.toLowerCase().includes('calculator'));
      assert.notEqual(calcWindow, undefined);
      await root.switchToWindow(calcWindow!.handle);
      const results = await root.$('~CalculatorResults');
      assert.equal(await results.isExisting(), true);
    });

    it('switching to Notepad by handle from windows: getWindows gives access to text area', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      const notepadWindow = windows.find((w) => w.title.toLowerCase().includes('notepad'));
      assert.notEqual(notepadWindow, undefined);
      await root.switchToWindow(notepadWindow!.handle);
      const textArea = await getNotepadTextArea(root);
      assert.equal(await textArea.isExisting(), true);
    });

    it('includes windows with empty title (untitled windows are not filtered out)', async () => {
      const windows = (await root.executeScript('windows: getWindows', [])) as Array<{
        handle: string;
        title: string;
        className: string;
      }>;
      // getWindowHandles only returns titled windows — getWindows should return >= that count
      const titledHandles = await root.getWindowHandles();
      assert.ok(windows.length >= titledHandles.length);
    });
  });

  describe('getPageSource', () => {
    it('returns a non-empty XML string', async () => {
      const source = await calc.getPageSource();
      assert.equal(typeof source, 'string');
      assert.ok(source.length > 0);
    });

    it('XML contains Button elements for the Calculator', async () => {
      const source = await calc.getPageSource();
      assert.ok(source.includes('Button'));
    });

    it('XML contains CalculatorResults AutomationId', async () => {
      const source = await calc.getPageSource();
      assert.ok(source.includes('CalculatorResults'));
    });
  });

  describe('getScreenshot', () => {
    it('returns a non-empty base64 string', async () => {
      const screenshot = await calc.takeScreenshot();
      assert.equal(typeof screenshot, 'string');
      assert.ok(screenshot.length > 0);
    });

    it('decoded bytes start with PNG magic bytes', async () => {
      const screenshot = await calc.takeScreenshot();
      const buffer = Buffer.from(screenshot, 'base64');
      // PNG magic: 89 50 4E 47
      assert.equal(buffer[0], 0x89);
      assert.equal(buffer[1], 0x50); // P
      assert.equal(buffer[2], 0x4e); // N
      assert.equal(buffer[3], 0x47); // G
    });
  });
});
