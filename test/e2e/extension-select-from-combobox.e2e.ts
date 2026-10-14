import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import type {Browser} from 'webdriverio';

import {createCharmapSession, createMsaaLegacyControlsSession, quitSession} from './helpers/session.js';

/**
 * windows: selectFromCombobox — open a container, find the entry with the exact text,
 * select it, close the popup again. Checked against the app itself (the combo's value,
 * the msaa-legacy-controls status label), not against accessibility state alone.
 *
 * Fixtures:
 * - msaa-legacy-controls `cmbCategories`: stock WinForms DropDownList ComboBox
 *   (Books / Electronics / Groceries / Toys); the status label reports "Combo: open/closed".
 * - msaa-legacy-controls `wpfVirtualCombo`: hosted WPF ComboBox with 300 entries
 *   ("Item 001".."Item 300") on a VirtualizingStackPanel, so only the rows on screen exist
 *   in UIA; the rest are reached through ItemContainerPattern and realized. The status
 *   label reports "WpfCombo: <item>".
 * - msaa-legacy-controls `nativeTree`: stock TreeView, a container with no
 *   ExpandCollapsePattern of its own, searched as it is.
 * - Charmap's font ComboBox (`~105`): Win32 combo with hundreds of entries, most of
 *   them off screen when the list opens.
 */

async function statusText(driver: Browser): Promise<string> {
  return String(await (await driver.$('~statusLabel')).getAttribute('Name'));
}

// WebdriverIO resolves a `no such element` response to executeScript with the error
// object rather than rejecting (it treats it like a missing element), so accept both.
async function expectNoSuchElement(call: Promise<unknown>): Promise<void> {
  const outcome = await call.then(
    (value) => value,
    (err: unknown) => err,
  );
  const text = outcome instanceof Error ? outcome.message : JSON.stringify(outcome);
  expect(text).toMatch(/no such element/i);
}

async function comboValue(driver: Browser, selector: string): Promise<string> {
  return String(await driver.executeScript('windows: getValue', [await driver.$(selector)]));
}

describe('windows: selectFromCombobox', () => {
  describe('stock WinForms ComboBox', () => {
    const COMBO = '~cmbCategories';
    let app: Browser;

    beforeAll(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    afterAll(async () => {
      await quitSession(app);
    });

    it('selects an entry from the closed combo box and closes it again', async () => {
      expect(await statusText(app)).toContain('Combo: closed');

      const combo = await app.$(COMBO);
      await app.executeScript('windows: selectFromCombobox', [{elementId: await combo.elementId, value: 'Groceries'}]);

      expect(await comboValue(app, COMBO)).toBe('Groceries');
      expect(await statusText(app)).toContain('Combo: closed');
    });

    it('accepts (element, value) as two arguments', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Toys']);
      expect(await comboValue(app, COMBO)).toBe('Toys');
    });

    it('selects the entry above the current selection', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Books']);
      expect(await comboValue(app, COMBO)).toBe('Books');
    });

    it('fails with no such element for text that only partly matches, leaving the value and closing the popup', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Electronics']);

      await expectNoSuchElement(app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Grocer']));
      expect(await comboValue(app, COMBO)).toBe('Electronics');
      expect(await statusText(app)).toContain('Combo: closed');
    });

    it('matches case-sensitively', async () => {
      await expectNoSuchElement(app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'toys']));
    });
  });

  describe('virtualized WPF ComboBox (hosted in msaa-legacy-controls)', () => {
    const COMBO = '~wpfVirtualCombo';
    let app: Browser;

    // A non-editable WPF ComboBox has no ValuePattern: the fixture's status label reports
    // the selection instead.
    async function wpfComboValue(): Promise<string> {
      return /WpfCombo: (.*)$/.exec(await statusText(app))?.[1] ?? '';
    }

    beforeAll(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    afterAll(async () => {
      await quitSession(app);
    });

    it('realizes only part of its 300 entries while open', async () => {
      const combo = await app.$(COMBO);
      await app.executeScript('windows: expand', [combo]);
      try {
        const items = await combo.$$('.//ListItem');
        expect(items.length).toBeGreaterThan(5);
        expect(items.length).toBeLessThan(60);
        expect(await combo.$$('.//ListItem[@Name="Item 290"]')).toHaveLength(0);
      } finally {
        await app.executeScript('windows: collapse', [combo]);
        await app.waitUntil(async () => (await combo.getAttribute('ExpandCollapseState')) === 'Collapsed', {
          timeoutMsg: 'WPF ComboBox did not close',
        });
      }
    });

    it('selects an entry far below the realized ones', async () => {
      expect(await wpfComboValue()).toBe('Item 001');

      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 290']);

      expect(await wpfComboValue()).toBe('Item 290');
      expect(await (await app.$(COMBO)).getAttribute('ExpandCollapseState')).toBe('Collapsed');
    });

    it('selects an entry far above the current selection', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 002']);

      expect(await wpfComboValue()).toBe('Item 002');
      expect(await (await app.$(COMBO)).getAttribute('ExpandCollapseState')).toBe('Collapsed');
    });

    it('fails with no such element for an entry past the end', async () => {
      await expectNoSuchElement(app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 301']));

      expect(await wpfComboValue()).toBe('Item 002');
      expect(await (await app.$(COMBO)).getAttribute('ExpandCollapseState')).toBe('Collapsed');
    });
  });

  describe('container without ExpandCollapsePattern (TreeView)', () => {
    let app: Browser;

    beforeAll(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    afterAll(async () => {
      await quitSession(app);
    });

    it('selects a tree item by its text', async () => {
      const tree = await app.$('//Tree[@Name="nativeTree"]');
      await app.executeScript('windows: selectFromCombobox', [tree, 'Datacenters']);

      const node = await app.$('//TreeItem[@Name="Datacenters"]');
      expect(String(await node.getAttribute('SelectionItem.IsSelected'))).toBe('true');
    });
  });

  describe('Win32 ComboBox with many entries (Charmap font list)', () => {
    const COMBO = '~105';
    let charmap: Browser;
    let fonts: string[];

    beforeAll(async () => {
      charmap = await createCharmapSession();

      // Read the font names once, with the list open, then close it again.
      const combo = await charmap.$(COMBO);
      await charmap.executeScript('windows: expand', [combo]);
      const items = await combo.$$('.//ListItem');
      fonts = [];
      for (const item of items) {
        fonts.push(String(await item.getAttribute('Name')));
      }
      await charmap.executeScript('windows: collapse', [combo]);
      await charmap.waitUntil(async () => (await combo.getAttribute('ExpandCollapseState')) === 'Collapsed', {
        timeoutMsg: 'font ComboBox did not close after reading its entries',
      });
    });

    afterAll(async () => {
      await quitSession(charmap);
    });

    it('lists enough fonts that the last one starts off screen', () => {
      expect(fonts.length).toBeGreaterThan(20);
    });

    it('selects the last font in the list', async () => {
      const last = fonts[fonts.length - 1];
      await charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), last]);

      expect(await comboValue(charmap, COMBO)).toBe(last);
      expect(await (await charmap.$(COMBO)).getAttribute('ExpandCollapseState')).toBe('Collapsed');
    });

    it('selects the first font, above the current selection', async () => {
      const first = fonts[0];
      await charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), first]);

      expect(await comboValue(charmap, COMBO)).toBe(first);
    });

    it('fails with no such element for a font that is not installed', async () => {
      const before = await comboValue(charmap, COMBO);
      await expectNoSuchElement(
        charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), 'No Such Font 12345']),
      );

      expect(await comboValue(charmap, COMBO)).toBe(before);
      expect(await (await charmap.$(COMBO)).getAttribute('ExpandCollapseState')).toBe('Collapsed');
    });
  });
});
