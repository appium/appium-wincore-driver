import assert from 'node:assert/strict';
import {after, before, beforeEach, describe, it} from 'node:test';

import type {Browser, Selector} from 'webdriverio';

import {
  createCalculatorSession,
  createNotepadSession,
  getNotepadTextArea,
  quitSession,
  resetCalculator,
  clearNotepad,
} from './helpers/session.js';

describe('W3C element commands', () => {
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

  describe('getProperty / getAttribute', () => {
    it('gets the Name property of the result display element', async () => {
      const name = await calc.$('~CalculatorResults').getAttribute('Name');
      assert.ok(name);
    });

    it('gets the AutomationId property of a button', async () => {
      const automationId = await calc.$('~num1Button').getAttribute('AutomationId');
      assert.equal(automationId, 'num1Button');
    });

    it('gets the IsEnabled property of a button', async () => {
      const isEnabled = await calc.$('~equalButton').getAttribute('IsEnabled');
      assert.ok(isEnabled);
    });

    it('gets the ControlType property of a button', async () => {
      const controlType = await calc.$('~num1Button').getAttribute('ControlType');
      assert.ok(controlType);
    });
  });

  describe('getText', () => {
    it('returns text content of the result display after pressing a digit', async () => {
      await calc.$('~num5Button').click();
      const text = await calc.$('~CalculatorResults').getText();
      assert.ok(text.includes('5'));
    });

    it('returns a string for an element', async () => {
      const text = await calc.$('~num1Button').getText();
      assert.equal(typeof text, 'string');
    });
  });

  describe('getName', () => {
    it('returns the control type name for a Button element', async () => {
      const name = await calc.$('~num1Button').getTagName();
      assert.ok(name);
    });
  });

  describe('getElementRect', () => {
    it('returns a rect with positive width and height for a visible button', async () => {
      const rect = await calc.$('~num1Button').getSize();
      assert.ok(rect.width > 0);
      assert.ok(rect.height > 0);
    });

    it('returns x and y coordinates', async () => {
      const location = await calc.$('~num1Button').getLocation();
      assert.equal(typeof location.x, 'number');
      assert.equal(typeof location.y, 'number');
    });
  });

  describe('elementDisplayed', () => {
    it('returns true for a visible button', async () => {
      assert.equal(await calc.$('~num1Button').isDisplayed(), true);
    });
  });

  describe('elementEnabled', () => {
    it('returns true for an enabled button', async () => {
      assert.equal(await calc.$('~equalButton').isEnabled(), true);
    });
  });

  describe('elementSelected', () => {
    it('returns true for the active navigation mode item (Standard)', async () => {
      await calc.$('~TogglePaneButton').click();
      try {
        assert.equal(await calc.$('~Standard').isSelected(), true);
      } finally {
        await calc.$('~TogglePaneButton').click();
      }
    });
  });

  describe('active', () => {
    it('returns the clicked button itself, not the top-level window', async () => {
      await calc.$('~num3Button').click();
      const activeRef = await calc.getActiveElement();
      const active = await calc.$(activeRef as unknown as Selector);
      assert.equal(await active.getAttribute('AutomationId'), 'num3Button');
      assert.doesNotMatch((await active.getAttribute('ControlType')) as string, /Window|Pane/);
    });

    it('tracks focus moving to a different button', async () => {
      await calc.$('~num7Button').click();
      const activeRef = await calc.getActiveElement();
      const active = await calc.$(activeRef as unknown as Selector);
      assert.equal(await active.getAttribute('AutomationId'), 'num7Button');
    });
  });

  describe('click', () => {
    it('clicking digit buttons produces the expected result in the display', async () => {
      await calc.$('~num7Button').click();
      const text = await calc.$('~CalculatorResults').getText();
      assert.ok(text.includes('7'));
    });

    it('performs addition: 1 + 1 = 2', async () => {
      await calc.$('~num1Button').click();
      await calc.$('~plusButton').click();
      await calc.$('~num1Button').click();
      await calc.$('~equalButton').click();
      const text = await calc.$('~CalculatorResults').getText();
      assert.ok(text.includes('2'));
    });
  });

  describe('setValue and clear', () => {
    beforeEach(async () => {
      await clearNotepad(notepad);
    });

    it('sets a value in Notepad text area and getText returns it', async () => {
      const textArea = await getNotepadTextArea(notepad);
      await textArea.setValue('Hello World');
      const text = await textArea.getText();
      assert.ok(text.includes('Hello World'));
    });

    it('clear empties the Notepad text area', async () => {
      const textArea = await getNotepadTextArea(notepad);
      await textArea.setValue('some text');
      await textArea.clearValue();
      const text = await textArea.getText();
      assert.equal(text.trim(), '');
    });
  });
});
