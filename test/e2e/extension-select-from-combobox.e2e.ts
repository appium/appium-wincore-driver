import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

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
  assert.match(text, /no such element/i);
}

async function comboValue(driver: Browser, selector: string): Promise<string> {
  return String(await driver.executeScript('windows: getValue', [await driver.$(selector)]));
}

describe('windows: selectFromCombobox', () => {
  describe('stock WinForms ComboBox', () => {
    const COMBO = '~cmbCategories';
    let app: Browser;

    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('selects an entry from the closed combo box and closes it again', async () => {
      assert.ok(String(await statusText(app)).includes('Combo: closed'));

      const combo = await app.$(COMBO);
      await app.executeScript('windows: selectFromCombobox', [{elementId: await combo.elementId, value: 'Groceries'}]);

      assert.equal(await comboValue(app, COMBO), 'Groceries');
      assert.ok(String(await statusText(app)).includes('Combo: closed'));
    });

    it('accepts (element, value) as two arguments', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Toys']);
      assert.equal(await comboValue(app, COMBO), 'Toys');
    });

    it('selects the entry above the current selection', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Books']);
      assert.equal(await comboValue(app, COMBO), 'Books');
    });

    it('fails with no such element for text that only partly matches, leaving the value and closing the popup', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Electronics']);

      await expectNoSuchElement(app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Grocer']));
      assert.equal(await comboValue(app, COMBO), 'Electronics');
      assert.ok(String(await statusText(app)).includes('Combo: closed'));
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

    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('realizes only part of its 300 entries while open', async () => {
      const combo = await app.$(COMBO);
      await app.executeScript('windows: expand', [combo]);
      try {
        const items = await combo.$$('.//ListItem');
        assert.ok((await items.length) > 5);
        assert.ok((await items.length) < 60);
        assert.equal((await combo.$$('.//ListItem[@Name="Item 290"]')).length, 0);
      } finally {
        await app.executeScript('windows: collapse', [combo]);
        await app.waitUntil(async () => (await combo.getAttribute('ExpandCollapseState')) === 'Collapsed', {
          timeoutMsg: 'WPF ComboBox did not close',
        });
      }
    });

    it('selects an entry far below the realized ones', async () => {
      assert.equal(await wpfComboValue(), 'Item 001');

      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 290']);

      assert.equal(await wpfComboValue(), 'Item 290');
      assert.equal(await (await app.$(COMBO)).getAttribute('ExpandCollapseState'), 'Collapsed');
    });

    it('selects an entry far above the current selection', async () => {
      await app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 002']);

      assert.equal(await wpfComboValue(), 'Item 002');
      assert.equal(await (await app.$(COMBO)).getAttribute('ExpandCollapseState'), 'Collapsed');
    });

    it('fails with no such element for an entry past the end', async () => {
      await expectNoSuchElement(app.executeScript('windows: selectFromCombobox', [await app.$(COMBO), 'Item 301']));

      assert.equal(await wpfComboValue(), 'Item 002');
      assert.equal(await (await app.$(COMBO)).getAttribute('ExpandCollapseState'), 'Collapsed');
    });
  });

  describe('container without ExpandCollapsePattern (TreeView)', () => {
    let app: Browser;

    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('selects a tree item by its text', async () => {
      const tree = await app.$('//Tree[@Name="nativeTree"]');
      await app.executeScript('windows: selectFromCombobox', [tree, 'Datacenters']);

      const node = await app.$('//TreeItem[@Name="Datacenters"]');
      assert.equal(String(await node.getAttribute('SelectionItem.IsSelected')), 'true');
    });
  });

  describe('Win32 ComboBox with many entries (Charmap font list)', () => {
    const COMBO = '~105';
    let charmap: Browser;
    let fonts: string[];

    before(async () => {
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

    after(async () => {
      await quitSession(charmap);
    });

    it('lists enough fonts that the last one starts off screen', () => {
      assert.ok(fonts.length > 20);
    });

    it('selects the last font in the list', async () => {
      const last = fonts[fonts.length - 1];
      await charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), last]);

      assert.equal(await comboValue(charmap, COMBO), last);
      assert.equal(await (await charmap.$(COMBO)).getAttribute('ExpandCollapseState'), 'Collapsed');
    });

    it('selects the first font, above the current selection', async () => {
      const first = fonts[0];
      await charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), first]);

      assert.equal(await comboValue(charmap, COMBO), first);
    });

    it('fails with no such element for a font that is not installed', async () => {
      const before = await comboValue(charmap, COMBO);
      await expectNoSuchElement(
        charmap.executeScript('windows: selectFromCombobox', [await charmap.$(COMBO), 'No Such Font 12345']),
      );

      assert.equal(await comboValue(charmap, COMBO), before);
      assert.equal(await (await charmap.$(COMBO)).getAttribute('ExpandCollapseState'), 'Collapsed');
    });
  });
});
