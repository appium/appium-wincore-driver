import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, createNotepadSession, quitSession} from './helpers/session.js';

describe('back and forward', () => {
  let notepad: Browser;

  before(async () => {
    notepad = await createNotepadSession();
  });

  after(async () => {
    await quitSession(notepad);
  });

  it('back() completes without error on an active window', async () => {
    assert.equal(await notepad.back(), null);
  });

  it('forward() completes without error on an active window', async () => {
    assert.equal(await notepad.forward(), null);
  });

  it('back() followed by forward() does not throw', async () => {
    await notepad.back();
    await notepad.forward();
  });
});

describe('getTitle', () => {
  let notepad: Browser;
  let calc: Browser;

  before(async () => {
    notepad = await createNotepadSession();
    calc = await createCalculatorSession();
  });

  after(async () => {
    await quitSession(notepad);
    await quitSession(calc);
  });

  it('returns a string for the Notepad window', async () => {
    const title = await notepad.getTitle();
    assert.equal(typeof title, 'string');
    assert.ok(title.length > 0);
  });

  it('Notepad title contains "Notepad"', async () => {
    const title = await notepad.getTitle();
    assert.ok(title.includes('Notepad'));
  });

  it('Calculator title contains "Calculator"', async () => {
    const title = await calc.getTitle();
    assert.ok(title.includes('Calculator'));
  });

  it('returns the same title on repeated calls', async () => {
    const first = await notepad.getTitle();
    const second = await notepad.getTitle();
    assert.equal(first, second);
  });
});

describe('setWindowRect', () => {
  let calc: Browser;
  let originalRect: {x: number; y: number; width: number; height: number};

  before(async () => {
    calc = await createCalculatorSession();
    originalRect = await calc.getWindowRect();
  });

  after(async () => {
    try {
      await calc.setWindowRect(originalRect.x, originalRect.y, originalRect.width, originalRect.height);
    } catch {
      // noop — restore best-effort
    }
    await quitSession(calc);
  });

  it('returns a Rect object with numeric x, y, width, height', async () => {
    const rect = await calc.setWindowRect(100, 100, 800, 600);
    assert.equal(typeof rect.x, 'number');
    assert.equal(typeof rect.y, 'number');
    assert.equal(typeof rect.width, 'number');
    assert.equal(typeof rect.height, 'number');
  });

  it('moves the window to the requested position', async () => {
    const rect = await calc.setWindowRect(150, 150, 800, 600);
    assert.equal(rect.x, 150);
    assert.equal(rect.y, 150);
  });

  it('resizes only (preserves position) when x and y are null', async () => {
    await calc.setWindowRect(200, 200, 800, 600);
    const rect = await calc.setWindowRect(null, null, 900, 700);
    assert.equal(rect.x, 200);
    assert.equal(rect.y, 200);
  });

  it('moves only (preserves size) when width and height are null', async () => {
    await calc.setWindowRect(100, 100, 800, 600);
    const rect = await calc.setWindowRect(250, 250, null, null);
    assert.equal(rect.x, 250);
    assert.equal(rect.y, 250);
    assert.equal(rect.width, 800);
    assert.equal(rect.height, 600);
  });
});

describe('getElementScreenshot', () => {
  let calc: Browser;

  before(async () => {
    calc = await createCalculatorSession();
  });

  after(async () => {
    await quitSession(calc);
  });

  it('returns a non-empty base64 string for an element', async () => {
    const btn = await calc.$('~num1Button');
    await btn.waitForExist();
    const screenshot = await calc.takeElementScreenshot(await btn.elementId);
    assert.equal(typeof screenshot, 'string');
    assert.ok(screenshot.length > 0);
  });

  it('decoded bytes start with PNG magic bytes (89 50 4E 47)', async () => {
    const btn = await calc.$('~num1Button');
    await btn.waitForExist();
    const screenshot = await calc.takeElementScreenshot(await btn.elementId);
    const buffer = Buffer.from(screenshot, 'base64');
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50); // P
    assert.equal(buffer[2], 0x4e); // N
    assert.equal(buffer[3], 0x47); // G
  });

  it('screenshot dimensions are non-zero', async () => {
    const btn = await calc.$('~num1Button');
    await btn.waitForExist();
    const screenshot = await calc.takeElementScreenshot(await btn.elementId);
    const buffer = Buffer.from(screenshot, 'base64');
    // PNG IHDR chunk starts at byte 16; width at 16-19, height at 20-23
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert.ok(width > 0);
    assert.ok(height > 0);
  });
});
