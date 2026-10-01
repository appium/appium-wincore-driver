import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import type { Browser } from 'webdriverio';
import { createMsaaLegacyControlsSession, quitSession } from './helpers/session.js';

/**
 * Standard accessibility values (ValuePattern / LegacyIAccessible) and the verified
 * select / expand / collapse, against the MSAA-only msaa-legacy-controls fixture
 * (appium-wincore-test-apps). Every control there reaches UIA through the MSAA Proxy:
 * UIA Name is a placeholder ("Status Row 1", "Group Row"), the real content is in
 * accValue. The fixture's status label echoes every effect as plain text, so actions are
 * checked against the app, not against accessibility state alone.
 *
 * Spec: specs/standard-accessibility-values.md.
 */

const GRID_CELL = '//Edit[@Name="Status Row 1"]';
const group = (region: string) => `//Tree[@Name="legacyOutline"]/TreeItem[@LegacyValue="Region: ${region}"]`;

async function statusText(driver: Browser): Promise<string> {
    return String(await (await driver.$('~statusLabel')).getAttribute('Name'));
}

describe('standard accessibility values (MSAA-only fixture)', () => {
    describe('fixture sanity', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('grid cells and outline groups are served by the MSAA Proxy', async () => {
            expect(await (await app.$(GRID_CELL)).getAttribute('ProviderDescription')).toContain('MSAA Proxy');
            expect(await (await app.$(group('US East'))).getAttribute('ProviderDescription')).toContain('MSAA Proxy');
        });

        it('the stock TreeView is the UIA-native contrast', async () => {
            const node = await app.$('//TreeItem[@Name="Datacenters"]');
            expect(await node.getAttribute('ProviderDescription')).toContain('TreeView Item Proxy');
        });
    });

    describe('reading values', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('page source carries Value and LegacyValue on a grid cell', async () => {
            const source = await app.getPageSource();
            const cell = /<Edit [^>]*Name="Status Row 1"[^>]*>/.exec(source)?.[0] ?? '';
            expect(cell).toContain(' Value="Degraded"');
            expect(cell).toContain(' LegacyValue="Degraded"');
            expect(cell).toContain(' LegacyRole="29"');
        });

        it('a grid row has its content only in LegacyValue (no ValuePattern)', async () => {
            const source = await app.getPageSource();
            const row = /<Custom [^>]*Name="Row 1"[^>]*>/.exec(source)?.[0] ?? '';
            expect(row).toContain(' Value=""');
            expect(row).toContain(' LegacyValue="db-01;Database;US East;Degraded"');
        });

        it('XPath locates elements by content', async () => {
            expect(await app.$$('//Edit[@LegacyValue="Degraded"]').length).toBe(1);
            expect(await (await app.$('//Custom[starts-with(@LegacyValue, "db-01;")]')).getAttribute('Name')).toBe('Row 1');
            expect(await (await app.$('//TreeItem[@LegacyValue="db-01"]')).getAttribute('Name')).toBe('Host row 2');
        });

        it('getAttribute accepts the short names and the pattern-qualified aliases', async () => {
            const cell = await app.$(GRID_CELL);
            expect(await cell.getAttribute('LegacyValue')).toBe('Degraded');
            expect(await cell.getAttribute('LegacyIAccessible.Value')).toBe('Degraded');
            expect(await cell.getAttribute('Value.Value')).toBe('Degraded');
            expect(await cell.getAttribute('LegacyName')).toBe('Status Row 1');
            expect(String(await cell.getAttribute('LegacyRole'))).toBe('29');
        });

        it('ExpandCollapseState comes from LegacyState on MSAA-only groups', async () => {
            expect(await (await app.$(group('US East'))).getAttribute('ExpandCollapseState')).toBe('Expanded');
            expect(await (await app.$(group('EU West'))).getAttribute('ExpandCollapseState')).toBe('Collapsed');
        });

        it('ExpandCollapseState errors on an element that reports no state (never the raw LeafNode default)', async () => {
            await expect((await app.$(group('Archive'))).getAttribute('ExpandCollapseState'))
                .rejects.toThrow(/does not support ExpandCollapsePattern/);
        });

        it('getAttribute accepts every LegacyIAccessible alias', async () => {
            const cell = await app.$(GRID_CELL);
            expect(await cell.getAttribute('LegacyIAccessible.Name')).toBe('Status Row 1');
            expect(await cell.getAttribute('LegacyIAccessible.Description')).toBe('');
            expect(String(await cell.getAttribute('LegacyIAccessible.Role'))).toBe('29');
            // SELECTABLE | FOCUSABLE | READONLY
            expect(String(await cell.getAttribute('LegacyIAccessible.State'))).toBe(String(0x300040));
            expect(String(await cell.getAttribute('Value.IsReadOnly'))).toBe('true');
            const item = await app.$('//TreeItem[@LegacyValue="db-01"]');
            expect(await item.getAttribute('LegacyIAccessible.DefaultAction')).toBe('Select');
            expect(await item.getAttribute('LegacyDefaultAction')).toBe('Select');
        });

        it('find conditions accept LegacyValue (-windows uiautomation)', async () => {
            const found = await app.findElements(
                '-windows uiautomation', 'new PropertyCondition(AutomationElement.LegacyValueProperty, \'db-01\')');
            expect(found.length).toBe(2); // the grid cell and the outline item
        });
    });

    describe('page source hygiene', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('caps long values at 4096 characters in page source; getAttribute returns them in full', async () => {
            const source = await app.getPageSource();
            const value = / LegacyValue="(y*)"/.exec(/<[A-Za-z]+ [^>]*AutomationId="longValueBox"[^>]*>/.exec(source)?.[0] ?? '')?.[1];
            expect(value?.length).toBe(4096);
            const full = await (await app.$('//*[@AutomationId="longValueBox"]')).getAttribute('LegacyValue');
            expect(String(full).length).toBe(5000);
        });

        it('strips characters XML 1.0 cannot carry (the old driver wrote &#x1;)', async () => {
            const source = await app.getPageSource();
            expect(source).not.toMatch(/&#x[0-8bcef];|&#x1[0-9a-f];/i);
            const node = /<[A-Za-z]+ [^>]*AutomationId="ctrlCharBox"[^>]*>/.exec(source)?.[0] ?? '';
            expect(node).toContain(' Name="BadName"');
            expect(node).toContain(' LegacyValue="BadValue"');
        });

        it('leaves Legacy* empty on WPF elements (native UIA) hosted in the window', async () => {
            const source = await app.getPageSource();
            const button = /<Button [^>]*AutomationId="wpfButton"[^>]*>/.exec(source)?.[0] ?? '';
            expect(button).toContain(' FrameworkId="WPF"');
            for (const attr of ['LegacyValue', 'LegacyName', 'LegacyDescription', 'LegacyRole', 'LegacyState']) {
                expect(button).toContain(` ${attr}=""`);
            }
            // getAttribute still reads them live on any element.
            expect(await (await app.$('~wpfButton')).getAttribute('LegacyName')).toBe('WPF button');
        });
    });

    describe('windows: setValue on a RangeValue control', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('moves a WPF slider through RangeValuePattern (its interface ID was wrong before)', async () => {
            await app.executeScript('windows: setValue', [await app.$('~wpfSlider'), '6']);
            expect(await statusText(app)).toContain('WpfSlider: 6');
        });
    });

    describe('windows: expand / collapse on combo boxes (ALT+Down fallback)', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        // legacyComboState / legacyComboNoState: no ExpandCollapsePattern, no default action,
        // open only on ALT+Down — the customer case the client's keyboard fallback exists for.
        // One reports MSAA COLLAPSED/EXPANDED bits, the other reports nothing.
        it.each([
            ['stock ComboBox (real pattern)', '~cmbCategories', 'Combo'],
            ['legacy combo reporting state', '//ComboBox[@Name="legacyComboState"]', 'LegacyComboState'],
            ['legacy combo reporting no state', '//ComboBox[@Name="legacyComboNoState"]', 'LegacyComboNoState'],
        ])('%s opens and closes', async (_label, selector, statusKey) => {
            await app.executeScript('windows: expand', [await app.$(selector)]);
            expect(await statusText(app)).toContain(`${statusKey}: open`);
            await app.executeScript('windows: collapse', [await app.$(selector)]);
            expect(await statusText(app)).toContain(`${statusKey}: closed`);
        });
    });

    describe('password rule', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('never exposes a protected legacy control\'s value in page source or XPath', async () => {
            // The MSAA Proxy reports pinBox as IsPassword but still returns its PIN (4721)
            // from both Value and LegacyValue — the driver must blank them.
            const source = await app.getPageSource();
            expect(source).not.toContain('4721');
            expect(await app.$$('//Edit[@Name="pinBox" and @Value="" and @LegacyValue=""]').length).toBe(1);
        });

        it('a stock password TextBox stays empty too', async () => {
            expect(await app.$$('//Edit[@Name="passwordBox" and @Value="" and @LegacyValue=""]').length).toBe(1);
        });
    });

    describe('windows: select', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('selects an outline item through SelectionItemPattern', async () => {
            const item = await app.$('//TreeItem[@LegacyValue="db-01"]');
            expect(String(await item.getAttribute('SelectionItem.IsSelected'))).toBe('false');
            await app.executeScript('windows: select', [item]);
            expect(await statusText(app)).toContain('Outline selected: db-01');
            expect(String(await item.getAttribute('SelectionItem.IsSelected'))).toBe('true');
        });

        it('selects a grid cell through the LegacyIAccessible fallback (it has no SelectionItemPattern)', async () => {
            await app.executeScript('windows: select', [await app.$(GRID_CELL)]);
            expect(await statusText(app)).toContain('Grid: db-01/Status');
        });

        it('fails with InvalidElementState on a group that cannot be selected', async () => {
            const before = await statusText(app);
            await expect(app.executeScript('windows: select', [await app.$(group('EU West'))]))
                .rejects.toThrow(/InvalidElementState/);
            expect(await statusText(app)).toBe(before);
        });
    });

    describe('windows: expand / collapse', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('expands a collapsed MSAA-only group and its children appear', async () => {
            await app.executeScript('windows: expand', [await app.$(group('EU West'))]);
            expect(await statusText(app)).toContain('Outline expanded: US East,EU West');
            expect(await app.$$(`${group('EU West')}/TreeItem`).length).toBe(2);
        });

        it('expanding again leaves it expanded (no toggle)', async () => {
            await app.executeScript('windows: expand', [await app.$(group('EU West'))]);
            expect(await statusText(app)).toContain('Outline expanded: US East,EU West');
        });

        it('expanding an already expanded group does not collapse it', async () => {
            await app.executeScript('windows: expand', [await app.$(group('US East'))]);
            expect(await statusText(app)).toContain('Outline expanded: US East,EU West');
        });

        it('collapses an expanded group and its children disappear', async () => {
            await app.executeScript('windows: collapse', [await app.$(group('US East'))]);
            expect(await statusText(app)).toContain('Outline expanded: EU West');
            expect(await app.$$(`${group('US East')}/TreeItem`).length).toBe(0);
        });

        it('fails with InvalidElementState on a group whose state never changes', async () => {
            const before = await statusText(app);
            await expect(app.executeScript('windows: expand', [await app.$(group('Locked'))]))
                .rejects.toThrow(/InvalidElementState/);
            expect(await statusText(app)).toBe(before);
        });

        it('still acts on a group that never reports its state (no regression)', async () => {
            await app.executeScript('windows: expand', [await app.$(group('Archive'))]);
            expect(await statusText(app)).toContain('Archive');
        });

        it('expands the UIA-native TreeView node through ExpandCollapsePattern', async () => {
            await app.executeScript('windows: expand', [await app.$('//TreeItem[@Name="Datacenters"]')]);
            expect(await statusText(app)).toContain('Tree: expanded');
        });
    });

    describe('windows: invoke', () => {
        let app: Browser;
        beforeAll(async () => { app = await createMsaaLegacyControlsSession(); });
        afterAll(async () => { await quitSession(app); });

        it('runs the default action through InvokePattern (not SelectionItemPattern)', async () => {
            // The group exposes both Invoke and SelectionItem. With the old (wrong) Invoke
            // IID the driver fell through to Select(), which did nothing here.
            await app.executeScript('windows: invoke', [await app.$(group('EU West'))]);
            expect(await statusText(app)).toContain('EU West');
        });
    });
});
