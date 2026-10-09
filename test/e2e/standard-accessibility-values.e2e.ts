import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createMsaaLegacyControlsSession, quitSession} from './helpers/session.js';

/**
 * Standard accessibility values (ValuePattern / LegacyIAccessible) and the verified
 * select / expand / collapse, against the MSAA-only msaa-legacy-controls fixture
 * (appium-wincore-test-apps). Every control there reaches UIA through the MSAA Proxy:
 * UIA Name is a placeholder ("Status Row 1", "Group Row"), the real content is in
 * accValue. The fixture's status label echoes every effect as plain text, so actions are
 * checked against the app, not against accessibility state alone.
 */

const GRID_CELL = '//Edit[@Name="Status Row 1"]';
const group = (region: string) => `//Tree[@Name="legacyOutline"]/TreeItem[@LegacyValue="Region: ${region}"]`;

async function statusText(driver: Browser): Promise<string> {
  return String(await (await driver.$('~statusLabel')).getAttribute('Name'));
}

describe('standard accessibility values (MSAA-only fixture)', () => {
  describe('fixture sanity', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('grid cells and outline groups are served by the MSAA Proxy', async () => {
      assert.ok((await (await app.$(GRID_CELL)).getAttribute('ProviderDescription'))?.includes('MSAA Proxy'));
      assert.ok((await (await app.$(group('US East'))).getAttribute('ProviderDescription'))?.includes('MSAA Proxy'));
    });

    it('the stock TreeView is the UIA-native contrast', async () => {
      const node = await app.$('//TreeItem[@Name="Datacenters"]');
      assert.ok((await node.getAttribute('ProviderDescription'))?.includes('TreeView Item Proxy'));
    });
  });

  describe('reading values', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('page source carries Value and LegacyValue on a grid cell', async () => {
      const source = await app.getPageSource();
      const cell = /<Edit [^>]*Name="Status Row 1"[^>]*>/.exec(source)?.[0] ?? '';
      assert.ok(cell.includes(' Value="Degraded"'));
      assert.ok(cell.includes(' LegacyValue="Degraded"'));
      assert.ok(cell.includes(' LegacyRole="29"'));
    });

    it('a grid row has its content only in LegacyValue (no ValuePattern)', async () => {
      const source = await app.getPageSource();
      const row = /<Custom [^>]*Name="Row 1"[^>]*>/.exec(source)?.[0] ?? '';
      assert.ok(row.includes(' Value=""'));
      assert.ok(row.includes(' LegacyValue="db-01;Database;US East;Degraded"'));
    });

    it('XPath locates elements by content', async () => {
      assert.equal(await app.$$('//Edit[@LegacyValue="Degraded"]').length, 1);
      assert.equal(await (await app.$('//Custom[starts-with(@LegacyValue, "db-01;")]')).getAttribute('Name'), 'Row 1');
      assert.equal(await (await app.$('//TreeItem[@LegacyValue="db-01"]')).getAttribute('Name'), 'Host row 2');
    });

    it('getAttribute accepts the short names and the pattern-qualified aliases', async () => {
      const cell = await app.$(GRID_CELL);
      assert.equal(await cell.getAttribute('LegacyValue'), 'Degraded');
      assert.equal(await cell.getAttribute('LegacyIAccessible.Value'), 'Degraded');
      assert.equal(await cell.getAttribute('Value.Value'), 'Degraded');
      assert.equal(await cell.getAttribute('LegacyName'), 'Status Row 1');
      assert.equal(String(await cell.getAttribute('LegacyRole')), '29');
    });

    it('ExpandCollapseState comes from LegacyState on MSAA-only groups', async () => {
      assert.equal(await (await app.$(group('US East'))).getAttribute('ExpandCollapseState'), 'Expanded');
      assert.equal(await (await app.$(group('EU West'))).getAttribute('ExpandCollapseState'), 'Collapsed');
    });

    it('ExpandCollapseState errors on an element that reports no state (never the raw LeafNode default)', async () => {
      await assert.rejects(
        (await app.$(group('Archive'))).getAttribute('ExpandCollapseState'),
        /does not support ExpandCollapsePattern/,
      );
    });

    it('getAttribute accepts every LegacyIAccessible alias', async () => {
      const cell = await app.$(GRID_CELL);
      assert.equal(await cell.getAttribute('LegacyIAccessible.Name'), 'Status Row 1');
      assert.equal(await cell.getAttribute('LegacyIAccessible.Description'), '');
      assert.equal(String(await cell.getAttribute('LegacyIAccessible.Role')), '29');
      // SELECTABLE | FOCUSABLE | READONLY
      assert.equal(String(await cell.getAttribute('LegacyIAccessible.State')), String(0x300040));
      assert.equal(String(await cell.getAttribute('Value.IsReadOnly')), 'true');
      const item = await app.$('//TreeItem[@LegacyValue="db-01"]');
      assert.equal(await item.getAttribute('LegacyIAccessible.DefaultAction'), 'Select');
      assert.equal(await item.getAttribute('LegacyDefaultAction'), 'Select');
    });

    it('find conditions accept LegacyValue (-windows uiautomation)', async () => {
      const found = await app.findElements(
        '-windows uiautomation',
        "new PropertyCondition(AutomationElement.LegacyValueProperty, 'db-01')",
      );
      assert.equal(found.length, 2); // the grid cell and the outline item
    });
  });

  describe('page source hygiene', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('caps long values at 4096 characters in page source; getAttribute returns them in full', async () => {
      const source = await app.getPageSource();
      const value = / LegacyValue="(y*)"/.exec(
        /<[A-Za-z]+ [^>]*AutomationId="longValueBox"[^>]*>/.exec(source)?.[0] ?? '',
      )?.[1];
      assert.equal(value?.length, 4096);
      const full = await (await app.$('//*[@AutomationId="longValueBox"]')).getAttribute('LegacyValue');
      assert.equal(String(full).length, 5000);
    });

    it('strips characters XML 1.0 cannot carry (the old driver wrote &#x1;)', async () => {
      const source = await app.getPageSource();
      assert.doesNotMatch(source, /&#x[0-8bcef];|&#x1[0-9a-f];/i);
      const node = /<[A-Za-z]+ [^>]*AutomationId="ctrlCharBox"[^>]*>/.exec(source)?.[0] ?? '';
      assert.ok(node.includes(' Name="BadName"'));
      assert.ok(node.includes(' LegacyValue="BadValue"'));
    });

    it('leaves Legacy* empty on WPF elements (native UIA) hosted in the window', async () => {
      const source = await app.getPageSource();
      const button = /<Button [^>]*AutomationId="wpfButton"[^>]*>/.exec(source)?.[0] ?? '';
      assert.ok(button.includes(' FrameworkId="WPF"'));
      for (const attr of ['LegacyValue', 'LegacyName', 'LegacyDescription', 'LegacyRole', 'LegacyState']) {
        assert.ok(button.includes(` ${attr}=""`));
      }
      // getAttribute still reads them live on any element.
      assert.equal(await (await app.$('~wpfButton')).getAttribute('LegacyName'), 'WPF button');
    });
  });

  describe('windows: setValue on a RangeValue control', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('moves a WPF slider through RangeValuePattern (its interface ID was wrong before)', async () => {
      await app.executeScript('windows: setValue', [await app.$('~wpfSlider'), '6']);
      assert.ok((await statusText(app)).includes('WpfSlider: 6'));
    });
  });

  describe('windows: expand / collapse on combo boxes (ALT+Down fallback)', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    // legacyComboState / legacyComboNoState: no ExpandCollapsePattern, no default action,
    // open only on ALT+Down — the customer case the client's keyboard fallback exists for.
    // One reports MSAA COLLAPSED/EXPANDED bits, the other reports nothing.
    for (const [label, selector, statusKey] of [
      ['stock ComboBox (real pattern)', '~cmbCategories', 'Combo'],
      ['legacy combo reporting state', '//ComboBox[@Name="legacyComboState"]', 'LegacyComboState'],
      ['legacy combo reporting no state', '//ComboBox[@Name="legacyComboNoState"]', 'LegacyComboNoState'],
    ]) {
      it(`${label} opens and closes`, async () => {
        await app.executeScript('windows: expand', [await app.$(selector)]);
        assert.ok((await statusText(app)).includes(`${statusKey}: open`));
        await app.executeScript('windows: collapse', [await app.$(selector)]);
        assert.ok((await statusText(app)).includes(`${statusKey}: closed`));
      });
    }
  });

  describe('password rule', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it("never exposes a protected legacy control's value in page source or XPath", async () => {
      // The MSAA Proxy reports pinBox as IsPassword but still returns its PIN (4721)
      // from both Value and LegacyValue — the driver must blank them.
      const source = await app.getPageSource();
      // match attribute values only: AutomationId can embed the digits (e.g. "4721040")
      assert.doesNotMatch(source, /(?:Legacy)?Value="[^"]*4721/);
      assert.equal(await app.$$('//Edit[@Name="pinBox" and @Value="" and @LegacyValue=""]').length, 1);
    });

    it('a stock password TextBox stays empty too', async () => {
      assert.equal(await app.$$('//Edit[@Name="passwordBox" and @Value="" and @LegacyValue=""]').length, 1);
    });
  });

  describe('windows: select', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('selects an outline item through SelectionItemPattern', async () => {
      const item = await app.$('//TreeItem[@LegacyValue="db-01"]');
      assert.equal(String(await item.getAttribute('SelectionItem.IsSelected')), 'false');
      await app.executeScript('windows: select', [item]);
      assert.ok((await statusText(app)).includes('Outline selected: db-01'));
      assert.equal(String(await item.getAttribute('SelectionItem.IsSelected')), 'true');
    });

    it('selects a grid cell through the LegacyIAccessible fallback (it has no SelectionItemPattern)', async () => {
      await app.executeScript('windows: select', [await app.$(GRID_CELL)]);
      assert.ok((await statusText(app)).includes('Grid: db-01/Status'));
    });

    it('stays "not supported" on a native element without SelectionItemPattern (no MSAA fallback)', async () => {
      // A WPF Button: UIA core synthesises LegacyIAccessible for it, but the legacy
      // select fallback is MSAA-only — it must not move focus or report state errors.
      await assert.rejects(
        app.executeScript('windows: select', [await app.$('~wpfButton')]),
        /does not support SelectionItemPattern/,
      );
    });

    it('fails with InvalidElementState on a group that cannot be selected', async () => {
      const before = await statusText(app);
      await assert.rejects(
        app.executeScript('windows: select', [await app.$(group('EU West'))]),
        /InvalidElementState/,
      );
      assert.equal(await statusText(app), before);
    });
  });

  describe('windows: expand / collapse', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('expands a collapsed MSAA-only group and its children appear', async () => {
      await app.executeScript('windows: expand', [await app.$(group('EU West'))]);
      assert.ok((await statusText(app)).includes('Outline expanded: US East,EU West'));
      assert.equal(await app.$$(`${group('EU West')}/TreeItem`).length, 2);
    });

    it('expanding again leaves it expanded (no toggle)', async () => {
      await app.executeScript('windows: expand', [await app.$(group('EU West'))]);
      assert.ok((await statusText(app)).includes('Outline expanded: US East,EU West'));
    });

    it('expanding an already expanded group does not collapse it', async () => {
      await app.executeScript('windows: expand', [await app.$(group('US East'))]);
      assert.ok((await statusText(app)).includes('Outline expanded: US East,EU West'));
    });

    it('collapses an expanded group and its children disappear', async () => {
      await app.executeScript('windows: collapse', [await app.$(group('US East'))]);
      assert.ok((await statusText(app)).includes('Outline expanded: EU West'));
      assert.equal(await app.$$(`${group('US East')}/TreeItem`).length, 0);
    });

    it('fails with InvalidElementState on a group whose state never changes', async () => {
      const before = await statusText(app);
      await assert.rejects(app.executeScript('windows: expand', [await app.$(group('Locked'))]), /InvalidElementState/);
      assert.equal(await statusText(app), before);
    });

    it('still acts on a group that never reports its state (no regression)', async () => {
      await app.executeScript('windows: expand', [await app.$(group('Archive'))]);
      assert.ok((await statusText(app)).includes('Archive'));
    });

    it('expands the UIA-native TreeView node through ExpandCollapsePattern', async () => {
      await app.executeScript('windows: expand', [await app.$('//TreeItem[@Name="Datacenters"]')]);
      assert.ok((await statusText(app)).includes('Tree: expanded'));
    });
  });

  describe('windows: invoke', () => {
    let app: Browser;
    before(async () => {
      app = await createMsaaLegacyControlsSession();
    });
    after(async () => {
      await quitSession(app);
    });

    it('runs the default action through InvokePattern (not SelectionItemPattern)', async () => {
      // The group exposes both Invoke and SelectionItem. With the old (wrong) Invoke
      // IID the driver fell through to Select(), which did nothing here.
      await app.executeScript('windows: invoke', [await app.$(group('EU West'))]);
      assert.ok((await statusText(app)).includes('EU West'));
    });
  });
});
