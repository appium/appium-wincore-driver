/**
 * Unit tests for lib/powershell/conditions.ts
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {PSBoolean, PSString, PSInt32, PSInt32Array, PSControlType} from '../../lib/powershell/common.js';
import {
  PropertyCondition,
  MatchPropertyCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  TrueCondition,
  FalseCondition,
} from '../../lib/powershell/conditions.js';
import {Property} from '../../lib/powershell/types.js';
import {conditionToDto} from '../../lib/server/converter-bridge.js';

describe('TrueCondition', () => {
  it('returns TrueCondition PS expression', () => {
    const c = new TrueCondition();
    assert.ok(c.toString().includes('TrueCondition'));
  });
});

describe('FalseCondition', () => {
  it('returns FalseCondition PS expression', () => {
    const c = new FalseCondition();
    assert.ok(c.toString().includes('FalseCondition'));
  });
});

describe('PropertyCondition', () => {
  it('creates condition for a boolean property', () => {
    const c = new PropertyCondition(Property.IS_ENABLED, new PSBoolean(true));
    assert.ok(c.toString().includes('isenabled'));
    assert.ok(c.toString().includes('$true'));
  });

  it('creates condition for a string property', () => {
    const c = new PropertyCondition(Property.NAME, new PSString('Calculator'));
    assert.ok(c.toString().includes('name'));
  });

  it('creates condition for an int32 property', () => {
    const c = new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSInt32(12345));
    assert.ok(c.toString().includes('nativewindowhandle'));
    assert.ok(c.toString().includes('12345'));
  });

  it('creates condition for a control type property', () => {
    const c = new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('button'));
    assert.ok(c.toString().includes('controltype'));
  });

  it('strips trailing "property" suffix from property name', () => {
    // Should still work when passing 'isenabledproperty'
    const c = new PropertyCondition('isenabledproperty' as Property, new PSBoolean(false));
    assert.ok(c.toString().includes('isenabled'));
  });

  it('throws when boolean property receives non-PSBoolean value', () => {
    assert.throws(() => new PropertyCondition(Property.IS_ENABLED, new PSString('true')));
  });

  it('throws when string property receives non-PSString value', () => {
    assert.throws(() => new PropertyCondition(Property.NAME, new PSInt32(42)));
  });

  it('throws when int32 property receives non-PSInt32 value', () => {
    assert.throws(() => new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSBoolean(true)));
  });

  it('creates condition for int32 array property (RUNTIME_ID)', () => {
    const c = new PropertyCondition(Property.RUNTIME_ID, new PSInt32Array([1, 2, 3]));
    assert.ok(c.toString().includes('runtimeid'));
  });
});

describe('MatchPropertyCondition', () => {
  it('serializes contains() to a property DTO with match: "contains" and a normalized property name', () => {
    const c = new MatchPropertyCondition('name', 'שורות', 'contains');
    assert.deepEqual(conditionToDto(c), {
      type: 'property',
      property: 'Name',
      value: 'שורות',
      match: 'contains',
    });
  });

  it('serializes starts-with() to match: "startsWith"', () => {
    const c = new MatchPropertyCondition('AutomationId', 'first', 'startsWith');
    assert.deepEqual(conditionToDto(c), {
      type: 'property',
      property: 'AutomationId',
      value: 'first',
      match: 'startsWith',
    });
  });

  it('nests inside an AndCondition DTO alongside the node-test condition', () => {
    const and = new AndCondition(
      new TrueCondition(),
      new MatchPropertyCondition('JavaSimpleClass', 'Cell', 'contains'),
    );
    assert.deepEqual(conditionToDto(and), {
      type: 'and',
      conditions: [{type: 'true'}, {type: 'property', property: 'JavaSimpleClass', value: 'Cell', match: 'contains'}],
    });
  });
});

describe('AndCondition', () => {
  it('creates AND condition from two conditions', () => {
    const c1 = new PropertyCondition(Property.IS_ENABLED, new PSBoolean(true));
    const c2 = new PropertyCondition(Property.NAME, new PSString('Calc'));
    const and = new AndCondition(c1, c2);
    assert.ok(and.toString().includes('AndCondition'));
  });

  it('creates AND condition from three conditions', () => {
    const c1 = new TrueCondition();
    const c2 = new TrueCondition();
    const c3 = new FalseCondition();
    const and = new AndCondition(c1, c2, c3);
    assert.ok(and.toString().includes('AndCondition'));
  });

  it('throws when fewer than 2 conditions provided', () => {
    const c1 = new TrueCondition();
    assert.throws(() => new AndCondition(c1), /at least 2 conditions/);
    assert.throws(() => new AndCondition(), /at least 2 conditions/);
  });

  it('throws when non-Condition argument is passed', () => {
    const c1 = new TrueCondition();
    assert.throws(() => new AndCondition(c1, 'not-a-condition' as any));
  });
});

describe('OrCondition', () => {
  it('creates OR condition from two conditions', () => {
    const c1 = new TrueCondition();
    const c2 = new FalseCondition();
    const or = new OrCondition(c1, c2);
    assert.ok(or.toString().includes('OrCondition'));
  });

  it('throws when fewer than 2 conditions provided', () => {
    const c1 = new TrueCondition();
    assert.throws(() => new OrCondition(c1), /at least 2 conditions/);
  });

  it('throws when non-Condition argument is passed', () => {
    const c1 = new TrueCondition();
    assert.throws(() => new OrCondition(c1, {} as any));
  });
});

describe('NotCondition', () => {
  it('creates NOT condition from a condition', () => {
    const c = new TrueCondition();
    const not = new NotCondition(c);
    assert.ok(not.toString().includes('NotCondition'));
  });

  it('throws when non-Condition argument is passed', () => {
    assert.throws(() => new NotCondition('not-a-condition' as any));
  });
});
