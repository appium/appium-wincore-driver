import assert from 'node:assert/strict';
import {describe, it, mock} from 'node:test';

import {VirtualKey} from '../../lib/winapi/types/virtualkey.js';

// Off-Windows the DLLs can't load; stub only koffi's `load` so the real pure functions still run.
if (process.platform !== 'win32') {
  const {default: koffi} = await import('koffi');
  const lib = {func: () => () => 0};
  mock.module('koffi', {exports: {default: {...koffi, load: () => lib}}});
}
const {isExtendedKeyVk, sendsAsUnicodePacket} = await import('../../lib/winapi/user32.js');

describe('isExtendedKeyVk', () => {
  // Regression: SendInput must set KEYEVENTF_EXTENDEDKEY for these VKs, or
  // Windows can resolve them against the wrong physical key depending on
  // NumLock state (e.g. VK_DOWN colliding with the Numpad-2 key location).
  const extended: [string, VirtualKey][] = [
    ['VK_UP', VirtualKey.VK_UP],
    ['VK_DOWN', VirtualKey.VK_DOWN],
    ['VK_LEFT', VirtualKey.VK_LEFT],
    ['VK_RIGHT', VirtualKey.VK_RIGHT],
    ['VK_HOME', VirtualKey.VK_HOME],
    ['VK_END', VirtualKey.VK_END],
    ['VK_PRIOR (Page Up)', VirtualKey.VK_PRIOR],
    ['VK_NEXT (Page Down)', VirtualKey.VK_NEXT],
    ['VK_INSERT', VirtualKey.VK_INSERT],
    ['VK_DELETE', VirtualKey.VK_DELETE],
    ['VK_DIVIDE', VirtualKey.VK_DIVIDE],
    ['VK_NUMLOCK', VirtualKey.VK_NUMLOCK],
    ['VK_SNAPSHOT', VirtualKey.VK_SNAPSHOT],
    ['VK_RCONTROL', VirtualKey.VK_RCONTROL],
    ['VK_RMENU', VirtualKey.VK_RMENU],
    ['VK_LWIN', VirtualKey.VK_LWIN],
    ['VK_RWIN', VirtualKey.VK_RWIN],
    ['VK_APPS', VirtualKey.VK_APPS],
  ];
  for (const [name, vk] of extended) {
    it(`returns true for ${name}`, () => {
      assert.equal(isExtendedKeyVk(vk), true);
    });
  }

  const notExtended: [string, VirtualKey][] = [
    ['VK_KEY_A', VirtualKey.VK_KEY_A],
    ['VK_KEY_0', VirtualKey.VK_KEY_0],
    ['VK_RETURN', VirtualKey.VK_RETURN],
    ['VK_SPACE', VirtualKey.VK_SPACE],
    ['VK_NUMPAD2 (shares a scan code with VK_DOWN, but is not itself extended)', VirtualKey.VK_NUMPAD2],
    ['VK_SHIFT', VirtualKey.VK_SHIFT],
    ['VK_CONTROL (left)', VirtualKey.VK_CONTROL],
    ['VK_MENU (left Alt)', VirtualKey.VK_MENU],
  ];
  for (const [name, vk] of notExtended) {
    it(`returns false for ${name}`, () => {
      assert.equal(isExtendedKeyVk(vk), false);
    });
  }

  it('returns false for undefined (scan-code-based events have no vk)', () => {
    assert.equal(isExtendedKeyVk(undefined), false);
  });
});

describe('sendsAsUnicodePacket', () => {
  // executeKeys pauses after Unicode-packet keystrokes (VK_PACKET): queued packets can turn
  // into the last character, and keys behind them can be lost, when the target falls behind.
  for (const char of ['a', 'z', '0', '9']) {
    it(`is false for scan-code character ${char}`, () => {
      assert.equal(sendsAsUnicodePacket(char), false);
    });
  }

  for (const char of [' ', ',', '!', 'A', 'é', '\u{1F600}']) {
    it(`is true for ${JSON.stringify(char)} (no scan code)`, () => {
      assert.equal(sendsAsUnicodePacket(char), true);
    });
  }

  it('is true for every character with forceUnicode', () => {
    assert.equal(sendsAsUnicodePacket('a', true), true);
    assert.equal(sendsAsUnicodePacket('5', true), true);
  });

  it('is false for WebDriver special keys (virtual keys)', () => {
    assert.equal(sendsAsUnicodePacket(''), false); // Key.BACKSPACE
    assert.equal(sendsAsUnicodePacket('', true), false); // Key.TAB
  });
});
