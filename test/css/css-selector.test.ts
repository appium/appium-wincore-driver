import {describe, it, expect} from 'vitest';

import {cssToNativeLocator, UIA_CONDITION_STRATEGY} from '../../lib/css';
import {parseUiaSelector} from '../../lib/uia-selector/parser';

describe('cssToNativeLocator', () => {
  it('converts #id to an AutomationId equality condition', async () => {
    const {strategy, selector} = await cssToNativeLocator('#btn_ok');
    expect(strategy).toBe(UIA_CONDITION_STRATEGY);
    expect(selector).toBe(`[PropertyCondition]::new([AutomationElement]::AutomationIdProperty, 'btn_ok')`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'AutomationId', value: 'btn_ok'});
  });

  it('converts .class to a ClassName equality condition', async () => {
    const {selector} = await cssToNativeLocator('.MyClass');
    expect(selector).toBe(`[PropertyCondition]::new([AutomationElement]::ClassNameProperty, 'MyClass')`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'ClassName', value: 'MyClass'});
  });

  it('converts [name="x"] to a Name equality condition', async () => {
    const {selector} = await cssToNativeLocator('*[name="OK"]');
    expect(selector).toBe(`[PropertyCondition]::new([AutomationElement]::NameProperty, 'OK')`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'Name', value: 'OK'});
  });

  it('converts a tag name to a ControlType condition', async () => {
    const {selector} = await cssToNativeLocator('button');
    expect(selector).toBe(`[PropertyCondition]::new([AutomationElement]::ControlTypeProperty, [ControlType]::button)`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'ControlType', value: 'button'});
  });

  it('combines multiple attributes with AndCondition', async () => {
    const {selector} = await cssToNativeLocator('button[name="OK"]');
    expect(parseUiaSelector(selector)).toEqual({
      type: 'and',
      conditions: [
        {type: 'property', property: 'ControlType', value: 'button'},
        {type: 'property', property: 'Name', value: 'OK'},
      ],
    });
  });

  it('escapes single quotes in attribute values', async () => {
    const {selector} = await cssToNativeLocator(`[name="O'Brien"]`);
    expect(selector).toBe(`[PropertyCondition]::new([AutomationElement]::NameProperty, 'O''Brien')`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'Name', value: "O'Brien"});
  });

  it('round-trips values with several single quotes', async () => {
    const {selector} = await cssToNativeLocator(`[name="it's 'quoted'"]`);
    expect(parseUiaSelector(selector)).toEqual({type: 'property', property: 'Name', value: "it's 'quoted'"});
  });

  it('rejects unsupported operators (no partial match on UIA conditions)', async () => {
    await expect(cssToNativeLocator('[name^="OK"]')).rejects.toThrow();
  });

  it('rejects combinators', async () => {
    await expect(cssToNativeLocator('window button')).rejects.toThrow();
  });

  it('rejects unknown attributes', async () => {
    await expect(cssToNativeLocator('[bogus="x"]')).rejects.toThrow();
  });

  it('rejects unknown control types', async () => {
    await expect(cssToNativeLocator('not-a-real-control')).rejects.toThrow();
  });
});
