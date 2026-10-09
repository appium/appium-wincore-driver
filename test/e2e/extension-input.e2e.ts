import assert from 'node:assert/strict';
import {after, before, beforeEach, describe, it} from 'node:test';

import type {Browser, ChainablePromiseElement} from 'webdriverio';

import {
  createCalculatorSession,
  createNotepadSession,
  createCharmapSession,
  getNotepadTextArea,
  quitSession,
  resetCalculator,
  clearNotepad,
} from './helpers/session.js';

// Typed input is delivered to the target asynchronously — with forceUnicode each character
// is its own KEYEVENTF_UNICODE keystroke, so on a busy runner the last few can still be in
// Notepad's queue when the command returns. Poll for the expected text instead of reading
// once; returns the last text seen so a timeout still fails with a readable assertion.
async function waitForText(
  target: WebdriverIO.Element | ChainablePromiseElement,
  expected: string,
  timeout = 5000,
): Promise<string> {
  const element = (await target) as WebdriverIO.Element;
  let text = '';
  try {
    await element.waitUntil(
      async () => {
        text = await element.getText();
        return text.includes(expected);
      },
      {timeout, interval: 100},
    );
  } catch {
    // fall through — the caller's assertion reports what was actually there
  }
  return text;
}

// VirtualKeyCode for Delete
const VK_DELETE = 0x2e;
// VirtualKeyCode for Shift
const VK_SHIFT = 0x10;

describe('windows: keys, click, hover, scroll, clickAndDrag extension commands', () => {
  let calc: Browser;
  let notepad: Browser;

  before(async () => {
    calc = await createCalculatorSession();
    notepad = await createNotepadSession();
  });

  after(async () => {
    await quitSession(calc);
    await quitSession(notepad);
  });

  beforeEach(async () => {
    await resetCalculator(calc);
  });

  describe('windows: keys — text input', () => {
    it('types "123" via text action into Calculator and display shows 123', async () => {
      await calc.executeScript('windows: keys', [{actions: [{text: '123'}]}]);
      const display = await calc.$('~CalculatorResults');
      const text = await display.getText();
      assert.ok(text.includes('123'));
    });

    it('types multi-character text into Notepad and getText returns it', async () => {
      await clearNotepad(notepad);
      const textArea = await getNotepadTextArea(notepad);
      await textArea.click();
      await notepad.executeScript('windows: keys', [{actions: [{text: 'hello world'}, {pause: 100}]}]);
      assert.ok((await waitForText(textArea, 'hello world')).includes('hello world'));
    });

    it('types text with forceUnicode: true into Notepad', async () => {
      await clearNotepad(notepad);
      const textArea = await getNotepadTextArea(notepad);
      await textArea.click();
      await notepad.executeScript('windows: keys', [
        {
          actions: [{text: 'unicodetest'}, {pause: 100}],
          forceUnicode: true,
        },
      ]);
      assert.ok((await waitForText(textArea, 'unicodetest')).includes('unicodetest'));
    });

    it('sends virtualKeyCode for Delete key to clear Notepad input', async () => {
      await clearNotepad(notepad);
      const textArea = await getNotepadTextArea(notepad);
      await textArea.click();
      await notepad.executeScript('windows: keys', [{actions: [{text: 'abc'}]}]);
      // Select all then delete
      await notepad.executeScript('windows: keys', [
        {
          actions: [
            {virtualKeyCode: 0x11, down: true}, // Ctrl down
            {pause: 100},
            {text: 'a'},
            {pause: 100},
            {virtualKeyCode: 0x11, down: false}, // Ctrl up
            {pause: 100},
            {virtualKeyCode: VK_DELETE}, // Delete
          ],
        },
      ]);
      const text = await textArea.getText();
      assert.equal(text.trim(), '');
    });

    it('uses pause action to introduce delay between key inputs', async () => {
      await assert.doesNotReject(
        calc.executeScript('windows: keys', [
          {
            actions: [{text: '1'}, {pause: 200}, {text: '2'}],
          },
        ]),
      );
      const display = await calc.$('~CalculatorResults');
      const text = await display.getText();
      assert.ok(text.includes('12'));
    });

    it('sends modifier hold to produce uppercase in Notepad', async () => {
      await clearNotepad(notepad);
      const textArea = await getNotepadTextArea(notepad);
      await textArea.click();
      await notepad.executeScript('windows: keys', [
        {
          actions: [{virtualKeyCode: VK_SHIFT, down: true}, {text: 'a'}, {virtualKeyCode: VK_SHIFT, down: false}],
        },
      ]);
      const text = await textArea.getText();
      assert.ok(text.includes('A'));
    });
  });

  describe('windows: click', () => {
    it('clicks on the Five button by element reference and shows 5 in result', async () => {
      const btn = await calc.$('~num5Button');
      await calc.executeScript('windows: click', [{elementId: await btn.elementId}]);
      const display = await calc.$('~CalculatorResults');
      assert.ok((await display.getText()).includes('5'));
    });

    it('clicks by absolute x/y coordinates on the Nine button', async () => {
      const btn = await calc.$('~num9Button');
      const location = await btn.getLocation();
      const size = await btn.getSize();
      const windowRect = await calc.getWindowRect();
      const x = Math.round(windowRect.x + location.x + size.width / 2);
      const y = Math.round(windowRect.y + location.y + size.height / 2);
      await calc.executeScript('windows: click', [{x, y}]);
      const display = await calc.$('~CalculatorResults');
      assert.ok((await display.getText()).includes('9'));
    });

    it('clicks with button: right performs right-click without error', async () => {
      const btn = await calc.$('~num1Button');
      await assert.doesNotReject(
        calc.executeScript('windows: click', [
          {
            elementId: await btn.elementId,
            button: 'right',
          },
        ]),
      );
    });

    it('clicks with times: 3 on digit One shows 111', async () => {
      const btn = await calc.$('~num1Button');
      await calc.executeScript('windows: click', [
        {
          elementId: await btn.elementId,
          times: 3,
          interClickDelayMs: 50,
        },
      ]);
      const display = await calc.$('~CalculatorResults');
      assert.ok((await display.getText()).includes('111'));
    });

    it('clicks with durationMs: 200 as a long-press click', async () => {
      const btn = await calc.$('~num2Button');
      await assert.doesNotReject(
        calc.executeScript('windows: click', [
          {
            elementId: await btn.elementId,
            durationMs: 200,
          },
        ]),
      );
    });
  });

  describe('windows: hover', () => {
    it('hovers from one button to another without error', async () => {
      const startBtn = await calc.$('~num1Button');
      const endBtn = await calc.$('~num2Button');
      await assert.doesNotReject(
        calc.executeScript('windows: hover', [
          {
            startElementId: await startBtn.elementId,
            endElementId: await endBtn.elementId,
          },
        ]),
      );
    });

    it('hovers with absolute startX/startY and endX/endY coordinates', async () => {
      const btn = await calc.$('~num3Button');
      const loc = await btn.getLocation();
      const size = await btn.getSize();
      const cx = Math.round(loc.x + size.width / 2);
      const cy = Math.round(loc.y + size.height / 2);
      await assert.doesNotReject(
        calc.executeScript('windows: hover', [
          {
            startX: cx - 20,
            startY: cy,
            endX: cx,
            endY: cy,
          },
        ]),
      );
    });

    it('hovers with a custom durationMs', async () => {
      const btn = await calc.$('~num4Button');
      const endBtn = await calc.$('~num5Button');
      await assert.doesNotReject(
        calc.executeScript('windows: hover', [
          {
            startElementId: await btn.elementId,
            endElementId: await endBtn.elementId,
            durationMs: 500,
          },
        ]),
      );
    });
  });

  describe('windows: scroll', () => {
    let charmap: Browser;

    before(async () => {
      charmap = await createCharmapSession();
    });

    after(async () => {
      await quitSession(charmap);
    });

    it('scrolls the font list via elementId + deltaY: last item reachable, then back', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);
      await charmap.pause(200);

      // Anchor on the popup's own list container (ComboLBox), not a
      // ListItem — items virtualize as the list scrolls and a cached
      // item reference goes stale, but the list container itself is a
      // fixed element for the lifetime of the open popup.
      const listContainer = await charmap.$('//List');

      const items = await charmap.$$('//ListItem').getElements();
      assert.ok(items.length > 20);
      const first = items[0];
      const last = items[items.length - 1];
      assert.equal(String(await last.getAttribute('IsOffscreen')).toLowerCase(), 'true');

      // Positive deltaY scrolls down (W3C convention — see user32.ts
      // makeMouseWheelEvents).
      await charmap.executeScript('windows: scroll', [
        {
          elementId: await listContainer.elementId,
          deltaY: 36000,
        },
      ]);
      await charmap.waitUntil(async () => String(await last.getAttribute('IsOffscreen')).toLowerCase() === 'false', {
        timeoutMsg: 'last font item did not scroll into view via elementId scroll',
      });

      await charmap.executeScript('windows: scroll', [
        {
          elementId: await listContainer.elementId,
          deltaY: -36000,
        },
      ]);
      await charmap.waitUntil(async () => String(await first.getAttribute('IsOffscreen')).toLowerCase() === 'false', {
        timeoutMsg: 'first font item did not scroll back into view via elementId scroll',
      });
    });

    it('scrolls the font list via absolute x/y + deltaX/deltaY coordinates', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);
      await charmap.pause(200);

      const listContainer = await charmap.$('//List');

      const items = await charmap.$$('//ListItem').getElements();
      const last = items[items.length - 1];
      assert.equal(String(await last.getAttribute('IsOffscreen')).toLowerCase(), 'true');

      // getLocation()/getSize() return coordinates relative to the app's
      // root window (see getElementRect in lib/commands/element.ts),
      // but windows: scroll's x/y are absolute screen coordinates fed
      // straight to SetCursorPos — add the window's own screen offset
      // back in to convert.
      const windowRect = await charmap.getWindowRect();
      const loc = await listContainer.getLocation();
      const size = await listContainer.getSize();
      const cx = Math.round(windowRect.x + loc.x + size.width / 2);
      const cy = Math.round(windowRect.y + loc.y + 10);

      await charmap.executeScript('windows: scroll', [
        {
          x: cx,
          y: cy,
          deltaX: 0,
          deltaY: 36000,
        },
      ]);

      await charmap.waitUntil(async () => String(await last.getAttribute('IsOffscreen')).toLowerCase() === 'false', {
        timeoutMsg: 'last font item did not scroll into view via x/y scroll',
      });
    });
  });

  describe('windows: clickAndDrag', () => {
    it('drags from one position to another by coordinates without error', async () => {
      const btn1 = await calc.$('~num1Button');
      const btn2 = await calc.$('~num2Button');
      const loc1 = await btn1.getLocation();
      const size1 = await btn1.getSize();
      const loc2 = await btn2.getLocation();
      const size2 = await btn2.getSize();
      await assert.doesNotReject(
        calc.executeScript('windows: clickAndDrag', [
          {
            startX: Math.round(loc1.x + size1.width / 2),
            startY: Math.round(loc1.y + size1.height / 2),
            endX: Math.round(loc2.x + size2.width / 2),
            endY: Math.round(loc2.y + size2.height / 2),
            durationMs: 300,
          },
        ]),
      );
    });

    it('drags from startElementId to endElementId center', async () => {
      const startBtn = await calc.$('~num3Button');
      const endBtn = await calc.$('~num4Button');
      await assert.doesNotReject(
        calc.executeScript('windows: clickAndDrag', [
          {
            startElementId: await startBtn.elementId,
            endElementId: await endBtn.elementId,
            durationMs: 200,
          },
        ]),
      );
    });
  });
});
