import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {cssToNativeLocator, UIA_CONDITION_STRATEGY} from '../../lib/css/index.js';
import {AndCondition, PropertyCondition} from '../../lib/powershell/conditions.js';
import {convertStringToCondition} from '../../lib/powershell/converter.js';

describe('cssToNativeLocator', () => {
  it('converts #id to an AutomationId equality condition', async () => {
    const {strategy, selector} = await cssToNativeLocator('#btn_ok');
    assert.equal(strategy, UIA_CONDITION_STRATEGY);
    assert.equal(selector, `[PropertyCondition]::new([AutomationElement]::AutomationIdProperty, 'btn_ok')`);
    assert.ok(convertStringToCondition(selector) instanceof PropertyCondition);
  });

  it('converts .class to a ClassName equality condition', async () => {
    const {selector} = await cssToNativeLocator('.MyClass');
    assert.equal(selector, `[PropertyCondition]::new([AutomationElement]::ClassNameProperty, 'MyClass')`);
    assert.ok(convertStringToCondition(selector) instanceof PropertyCondition);
  });

  it('converts [name="x"] to a Name equality condition', async () => {
    const {selector} = await cssToNativeLocator('*[name="OK"]');
    assert.equal(selector, `[PropertyCondition]::new([AutomationElement]::NameProperty, 'OK')`);
  });

  it('converts a tag name to a ControlType condition', async () => {
    const {selector} = await cssToNativeLocator('button');
    assert.equal(selector, `[PropertyCondition]::new([AutomationElement]::ControlTypeProperty, [ControlType]::button)`);
    assert.ok(convertStringToCondition(selector) instanceof PropertyCondition);
  });

  it('combines multiple attributes with AndCondition', async () => {
    const {selector} = await cssToNativeLocator('button[name="OK"]');
    const condition = convertStringToCondition(selector);
    assert.ok(condition instanceof AndCondition);
  });

  it('escapes single quotes in attribute values', async () => {
    const {selector} = await cssToNativeLocator(`[name="O'Brien"]`);
    assert.equal(selector, `[PropertyCondition]::new([AutomationElement]::NameProperty, 'O''Brien')`);
    assert.ok(convertStringToCondition(selector) instanceof PropertyCondition);
  });

  it('rejects unsupported operators (no partial match on UIA conditions)', async () => {
    await assert.rejects(cssToNativeLocator('[name^="OK"]'));
  });

  it('rejects combinators', async () => {
    await assert.rejects(cssToNativeLocator('window button'));
  });

  it('rejects unknown attributes', async () => {
    await assert.rejects(cssToNativeLocator('[bogus="x"]'));
  });

  it('rejects unknown control types', async () => {
    await assert.rejects(cssToNativeLocator('not-a-real-control'));
  });
});
