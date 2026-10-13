import assert from 'node:assert/strict';
import {after, before, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createNotepadSession, getNotepadTextArea, quitSession, clearNotepad} from './helpers/session.js';

// Minimal 1×1 transparent PNG as base64
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('windows: clipboard extension commands', () => {
  let notepad: Browser;

  before(async () => {
    notepad = await createNotepadSession();
  });

  after(async () => {
    await quitSession(notepad);
  });

  beforeEach(async () => {
    await clearNotepad(notepad);
  });

  describe('setClipboard + getClipboard (plaintext)', () => {
    it('sets plaintext clipboard and getClipboard returns the same text (roundtrip)', async () => {
      const text = 'clipboard roundtrip test';
      const b64In = Buffer.from(text).toString('base64');
      await notepad.executeScript('windows: setClipboard', [{contentType: 'plaintext', b64Content: b64In}]);
      const b64Out = (await notepad.executeScript('windows: getClipboard', [{contentType: 'plaintext'}])) as string;
      const textOut = Buffer.from(b64Out, 'base64').toString();
      assert.ok(textOut.includes(text));
    });

    it('sets clipboard with explicit contentType: plaintext and getClipboard reads it back', async () => {
      const text = 'explicit type test';
      const b64 = Buffer.from(text).toString('base64');
      await notepad.executeScript('windows: setClipboard', [{contentType: 'plaintext', b64Content: b64}]);

      const b64Out = (await notepad.executeScript('windows: getClipboard', [{contentType: 'plaintext'}])) as string;
      assert.ok(Buffer.from(b64Out, 'base64').toString().includes(text));
    });

    it('clipboard value survives between get calls (unchanged)', async () => {
      const text = 'stable clipboard value';
      const b64 = Buffer.from(text).toString('base64');
      await notepad.executeScript('windows: setClipboard', [{contentType: 'plaintext', b64Content: b64}]);
      const first = (await notepad.executeScript('windows: getClipboard', [{contentType: 'plaintext'}])) as string;
      const second = (await notepad.executeScript('windows: getClipboard', [{contentType: 'plaintext'}])) as string;
      assert.equal(first, second);
    });
  });

  describe('setClipboard + getClipboard (image)', () => {
    it('sets an image clipboard and getClipboard with image type returns non-empty', async () => {
      await notepad.executeScript('windows: setClipboard', [
        {
          contentType: 'image',
          b64Content: TINY_PNG_BASE64,
        },
      ]);
      const result = (await notepad.executeScript('windows: getClipboard', [{contentType: 'image'}])) as string;
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    });
  });

  describe('clipboard integration with Notepad', () => {
    it('sets clipboard text, Ctrl+V pastes it into Notepad, getText shows pasted content', async () => {
      const pasteText = 'pasted from clipboard';
      const b64 = Buffer.from(pasteText).toString('base64');
      await notepad.executeScript('windows: setClipboard', [{contentType: 'plaintext', b64Content: b64}]);

      const textArea = await getNotepadTextArea(notepad);
      await textArea.click();
      // Ctrl+V to paste
      await notepad.keys(['Control', 'v']);

      const text = await textArea.getText();
      assert.ok(text.includes(pasteText));
    });
  });
});
