import assert from 'node:assert/strict';
import {after, afterEach, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {
  createCalculatorSession,
  createNotepadSession,
  createTodoSession,
  createExplorerSession,
  createCharmapSession,
  getNotepadTextArea,
  quitSession,
  resetCalculator,
  clearNotepad,
  createTodoTask,
  deleteTasks,
} from './helpers/session.js';

describe('windows: pattern extension commands', () => {
  let calc: Browser;
  let notepad: Browser;
  let todo: Browser;

  // before(async () => {
  //     calc = await createCalculatorSession();
  //     notepad = await createNotepadSession();
  // });

  // after(async () => {
  //     await quitSession(calc);
  //     await quitSession(notepad);
  // });

  describe('windows: invoke', () => {
    before(async () => {
      calc = await createCalculatorSession();
      // Calculator (UWP) finishes building its keypad UIA subtree a beat after
      // the window is up. Without this, the first `$('~num1Button')` in the
      // block races the tree and findElement throws NoSuchElement (later tests
      // don't see it — the tree is warm by then).
      await calc.$('~num1Button').waitForExist({timeout: 15_000});
    });

    after(async () => {
      await quitSession(calc);
    });

    afterEach(async () => {
      await resetCalculator(calc);
    });

    it('invokes the One button and result display shows 1', async () => {
      const oneBtn = await calc.$('~num1Button');
      await calc.executeScript('windows: invoke', [oneBtn]);
      const display = await calc.$('~CalculatorResults');

      await calc.waitUntil(async () => (await display.getText()).includes('1'), {
        timeoutMsg: 'CalculatorResults did not show 1 after invoking One',
      });
    });

    it('invokes the Equals button and result display shows the sum', async () => {
      await calc.$('~num2Button').click();
      await calc.$('~plusButton').click();
      await calc.$('~num3Button').click();
      const equalsBtn = await calc.$('~equalButton');
      await calc.executeScript('windows: invoke', [equalsBtn]);

      const display = await calc.$('~CalculatorResults');
      await calc.waitUntil(async () => (await display.getText()).includes('5'), {
        timeoutMsg: 'CalculatorResults did not show 5 after invoking Equals',
      });
    });
  });

  describe('windows: maximize / minimize / restore', () => {
    before(async () => {
      calc = await createCalculatorSession();
    });

    after(async () => {
      await quitSession(calc);
    });

    afterEach(async function restoreWindow() {
      // Always restore to a known state
      try {
        await resetCalculator(calc);
        const windowEl = await calc.executeScript('windows: getWindowElement', []);
        await calc.executeScript('windows: restore', [windowEl]);
      } catch {
        // noop
      }
    });

    it('maximizes the Calculator window and its rect grows', async () => {
      const windowEl = await calc.executeScript('windows: getWindowElement', []);
      // Ensure a known-normal baseline — if the window is already maximized
      // (e.g. carried over from a prior run), the rect can't grow further.
      await calc.executeScript('windows: restore', [windowEl]);
      const rectBefore = await calc.getWindowRect();

      await calc.executeScript('windows: maximize', [windowEl]);

      await calc.waitUntil(
        async () => {
          const rect = await calc.getWindowRect();
          return rect.width > rectBefore.width || rect.height > rectBefore.height;
        },
        {timeoutMsg: 'Calculator window rect did not grow after maximize'},
      );
    });

    it('minimizes then restores the Calculator window', async () => {
      const windowEl = await calc.executeScript('windows: getWindowElement', []);
      await calc.executeScript('windows: minimize', [windowEl]);
      await calc.executeScript('windows: restore', [windowEl]);
      // Window should be accessible again. Restore returns as soon as the visual
      // state is set, but a minimized UWP app is suspended and rebuilds its UIA
      // content tree a beat later — wait for it rather than checking once.
      const display = await calc.$('~CalculatorResults');
      await display.waitForExist({
        timeout: 10_000,
        timeoutMsg: 'Calculator UI did not come back after restore',
      });
    });

    it('restore on an already-normal window is a no-op: rect is unchanged', async () => {
      const windowEl = await calc.executeScript('windows: getWindowElement', []);
      const rectBefore = await calc.getWindowRect();

      await calc.executeScript('windows: restore', [windowEl]);

      const rectAfter = await calc.getWindowRect();
      assert.deepEqual(rectAfter, rectBefore);
    });
  });

  describe('windows: setFocus', () => {
    before(async () => {
      calc = await createCalculatorSession();
    });

    after(async () => {
      await quitSession(calc);
    });

    afterEach(async () => {
      await resetCalculator(calc);
    });

    it('sets focus on the result display element: HasKeyboardFocus becomes true', async () => {
      // Move focus elsewhere first so the check proves setFocus did something
      const clearBtn = await calc.$('~clearButton');
      await clearBtn.click();

      const display = await calc.$('~CalculatorResults');
      await calc.executeScript('windows: setFocus', [display]);

      await calc.waitUntil(
        async () => {
          const focused = await display.getAttribute('HasKeyboardFocus');
          return String(focused).toLowerCase() === 'true';
        },
        {timeoutMsg: 'CalculatorResults did not receive keyboard focus after setFocus'},
      );
    });
  });

  describe('windows: scrollIntoView', () => {
    let charmap: Browser;

    before(async () => {
      charmap = await createCharmapSession();
    });

    after(async () => {
      await quitSession(charmap);
    });

    it('scrolls an off-screen font list item into view: IsOffscreen flips to false', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);

      // Don't assume where the popup's viewport sits: Charmap remembers the last
      // selected font (the ComboBox test below selects one), so the list can open
      // scrolled anywhere — the last item is not necessarily off-screen. Wait for the
      // popup to lay out, then target whichever items it reports off-screen.
      let offscreen: WebdriverIO.Element[] = [];
      await charmap.waitUntil(
        async () => {
          const all = await charmap.$$('//ListItem').getElements();
          if (all.length <= 20) {
            return false;
          }
          offscreen = [...(await charmap.$$('//ListItem[@IsOffscreen="true"]').getElements())];
          return offscreen.length > 0;
        },
        {timeout: 10_000, timeoutMsg: 'font list never reported an off-screen item'},
      );

      const target = offscreen[offscreen.length - 1];
      const wasOffscreen = await target.getAttribute('IsOffscreen');
      assert.equal(String(wasOffscreen).toLowerCase(), 'true');

      await charmap.executeScript('windows: scrollIntoView', [target]);
      await charmap.waitUntil(
        async () => {
          const isOffscreen = await target.getAttribute('IsOffscreen');
          return String(isOffscreen).toLowerCase() === 'false';
        },
        {timeoutMsg: 'target list item was still off-screen after scrollIntoView'},
      );
    });
  });

  describe('windows: setValue / getValue (ValuePattern)', () => {
    before(async () => {
      notepad = await createNotepadSession();
      await clearNotepad(notepad);
    });

    after(async () => {
      await quitSession(notepad);
    });

    it('sets a value using ValuePattern and getValue returns it', async () => {
      const textArea = await getNotepadTextArea(notepad);
      await notepad.executeScript('windows: setValue', [textArea, 'pattern value test']);
      const result = await notepad.executeScript('windows: getValue', [textArea]);
      assert.ok(result.includes('pattern value test'));
    });
  });

  describe('windows: expand / collapse', () => {
    let explorer: Browser;

    before(async () => {
      explorer = await createExplorerSession();
    });

    after(async () => {
      await quitSession(explorer);
    });

    it('expands This PC and child drives become visible', async () => {
      const thisPC = await explorer.$('//TreeItem[@Name="This PC"]');
      await explorer.executeScript('windows: collapse', [thisPC]);
      await explorer.pause(300);

      await explorer.executeScript('windows: expand', [thisPC]);
      await explorer.pause(300);

      const children = await explorer.$$('//TreeItem[@Name="This PC"]/TreeItem').getElements();
      assert.ok(children.length > 0);
    });

    it('collapses This PC and child drives are no longer visible', async () => {
      const thisPC = await explorer.$('//TreeItem[@Name="This PC"]');
      await explorer.executeScript('windows: expand', [thisPC]);
      await explorer.pause(300);

      await explorer.executeScript('windows: collapse', [thisPC]);
      await explorer.pause(300);

      const children = await explorer.$$('//TreeItem[@Name="This PC"]/TreeItem').getElements();
      assert.equal(children.length, 0);
    });
  });

  describe('windows: expand / collapse (ComboBox)', () => {
    let charmap: Browser;

    before(async () => {
      charmap = await createCharmapSession();
    });

    after(async () => {
      await quitSession(charmap);
    });

    it('expands the font ComboBox: ExpandCollapseState becomes Expanded', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);

      await charmap.waitUntil(
        async () => {
          const state = await comboBox.getAttribute('ExpandCollapseState');
          return state === 'Expanded' || state === 'PartiallyExpanded';
        },
        {timeoutMsg: 'font ComboBox did not report Expanded state'},
      );
    });

    it('collapses the font ComboBox: ExpandCollapseState becomes Collapsed', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);
      await charmap.waitUntil(
        async () => {
          const state = await comboBox.getAttribute('ExpandCollapseState');
          return state === 'Expanded' || state === 'PartiallyExpanded';
        },
        {timeoutMsg: 'font ComboBox did not report Expanded state before collapsing'},
      );

      await charmap.executeScript('windows: collapse', [comboBox]);

      await charmap.waitUntil(async () => (await comboBox.getAttribute('ExpandCollapseState')) === 'Collapsed', {
        timeoutMsg: 'font ComboBox did not report Collapsed state',
      });
    });

    it('selects a font from the expanded ComboBox and its value updates', async () => {
      const comboBox = await charmap.$('~105');
      await charmap.executeScript('windows: expand', [comboBox]);
      await charmap.pause(200);

      const items = await charmap.$$('//ListItem').getElements();
      assert.ok(items.length > 0);

      const item = items[0];
      const fontName = await item.getAttribute('Name');

      await assert.doesNotReject(charmap.executeScript('windows: select', [item]));

      await charmap.pause(200);
      const value = await charmap.executeScript('windows: getValue', [comboBox]);
      assert.ok(value.includes(fontName));
    });
  });

  describe('windows: select / allSelectedItems / isMultiple / toggle', () => {
    before(async () => {
      todo = await createTodoSession();
      await createTodoTask(todo, 'First task');
      await createTodoTask(todo, 'Second task');
    });

    after(async () => {
      await deleteTasks(todo);
      await quitSession(todo);
    });

    it('toggles a task checkbox in To-Do', async () => {
      const checkbox = await todo.$('~CompleteTodoCheckBox');
      await assert.doesNotReject(todo.executeScript('windows: toggle', [checkbox]));
    });

    it('select selects a task item in the To-Do list', async () => {
      const item = await todo.$('//Custom/Group/List/ListItem[1]');
      await assert.doesNotReject(todo.executeScript('windows: select', [item]));
    });

    it('isMultiple returns a boolean for the To-Do task list container', async () => {
      const list = await todo.$('~TodosListView');
      const result = await todo.executeScript('windows: isMultiple', [list]);
      assert.equal(typeof result, 'boolean');
    });

    it('allSelectedItems returns an array for the To-Do task list container', async () => {
      const list = await todo.$('~TodosListView');
      const result = await todo.executeScript('windows: allSelectedItems', [list]);
      assert.equal(Array.isArray(result), true);
    });
  });
});
