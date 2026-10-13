/**
 * Unit tests for lib/powershell/common.ts (PS type wrappers)
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {W3C_ELEMENT_KEY} from 'appium/driver.js';

import {
  PSString,
  PSBoolean,
  PSInt32,
  PSInt32Array,
  PSAutomationHeadingLevel,
  PSOrientationType,
  PSControlType,
  PSPoint,
  PSRect,
  PSAutomationElement,
  PSCultureInfo,
} from '../../lib/powershell/common.js';

describe('PSString', () => {
  it('wraps value in double-quotes with unicode escaping', () => {
    const ps = new PSString('hello');
    assert.match(ps.toString(), /^".*"$/);
  });

  it('escapes each character as unicode codepoint', () => {
    const ps = new PSString('A');
    // 'A' is 0x0041
    assert.ok(ps.toString().includes('0x0041'));
  });

  it('handles empty string', () => {
    const ps = new PSString('');
    assert.equal(ps.toString(), '""');
  });

  it('handles special characters', () => {
    const ps = new PSString("it's a test");
    assert.match(ps.toString(), /^".*"$/);
  });
});

describe('PSBoolean', () => {
  it('returns $true for true', () => {
    assert.equal(new PSBoolean(true).toString(), '$true');
  });

  it('returns $false for false', () => {
    assert.equal(new PSBoolean(false).toString(), '$false');
  });

  it('throws for non-boolean input', () => {
    assert.throws(() => new PSBoolean('true' as any), /PSBoolean accepts only boolean/);
    assert.throws(() => new PSBoolean(1 as any), /PSBoolean accepts only boolean/);
    assert.throws(() => new PSBoolean(null as any), /PSBoolean accepts only boolean/);
  });
});

describe('PSInt32', () => {
  it('converts integer to string', () => {
    assert.equal(new PSInt32(42).toString(), '42');
    assert.equal(new PSInt32(0).toString(), '0');
    assert.equal(new PSInt32(-1).toString(), '-1');
  });

  it('throws for non-integer values', () => {
    assert.throws(() => new PSInt32(1.5), /PSInt32 accepts only integer values/);
    assert.throws(() => new PSInt32(NaN), /PSInt32 accepts only integer values/);
    assert.throws(() => new PSInt32(Infinity), /PSInt32 accepts only integer values/);
  });
});

describe('PSInt32Array', () => {
  it('wraps integer array in PS syntax', () => {
    const result = new PSInt32Array([1, 2, 3]).toString();
    assert.ok(result.includes('1, 2, 3'));
    assert.ok(result.includes('int32'));
  });

  it('handles empty array', () => {
    const result = new PSInt32Array([]).toString();
    assert.ok(result.includes('int32'));
  });

  it('throws for non-array input', () => {
    assert.throws(() => new PSInt32Array('1,2,3' as any), /PSInt32Array accepts only array of integers/);
  });

  it('throws for array with non-integer elements', () => {
    assert.throws(() => new PSInt32Array([1, 1.5, 3]), /PSInt32Array accepts only array of integers/);
  });
});

describe('PSAutomationHeadingLevel', () => {
  it('wraps valid heading level', () => {
    const ps = new PSAutomationHeadingLevel('level1');
    assert.ok(ps.toString().includes('level1'));
    assert.equal(ps.originalValue, 'level1');
  });

  it('accepts none heading level', () => {
    assert.doesNotThrow(() => new PSAutomationHeadingLevel('none'));
  });

  it('throws for invalid heading level', () => {
    assert.throws(() => new PSAutomationHeadingLevel('level10'), /PSAutomationHeadingLevel/);
    assert.throws(() => new PSAutomationHeadingLevel('invalid'), /PSAutomationHeadingLevel/);
  });
});

describe('PSOrientationType', () => {
  it('wraps valid orientation type', () => {
    const ps = new PSOrientationType('horizontal');
    assert.ok(ps.toString().includes('horizontal'));
    assert.equal(ps.originalValue, 'horizontal');
  });

  it('accepts none orientation type', () => {
    assert.doesNotThrow(() => new PSOrientationType('none'));
  });

  it('throws for invalid orientation type', () => {
    assert.throws(() => new PSOrientationType('diagonal'), /PSOrientationType/);
  });
});

describe('PSControlType', () => {
  it('wraps standard control types', () => {
    const ps = new PSControlType('button');
    assert.ok(ps.toString().includes('button'));
  });

  it('handles SemanticZoom as "semantic zoom"', () => {
    const ps = new PSControlType('semanticzoom');
    assert.equal(ps.toString(), 'semantic zoom');
  });

  it('handles AppBar as "app bar"', () => {
    const ps = new PSControlType('appbar');
    assert.equal(ps.toString(), 'app bar');
  });

  it('throws for invalid control type', () => {
    assert.throws(() => new PSControlType('unknowntype'), /PSControlType/);
  });

  it('accepts all standard ControlType values', () => {
    const types = [
      'window',
      'edit',
      'checkbox',
      'combobox',
      'list',
      'listitem',
      'menu',
      'menuitem',
      'pane',
      'tab',
      'tabitem',
    ];
    for (const t of types) {
      assert.doesNotThrow(() => new PSControlType(t));
    }
  });
});

describe('PSPoint', () => {
  it('creates PS point representation', () => {
    const ps = new PSPoint({x: 10, y: 20});
    const str = ps.toString();
    assert.ok(str.includes('10'));
    assert.ok(str.includes('20'));
    assert.ok(str.includes('Point'));
  });

  it('throws for missing y coordinate', () => {
    assert.throws(() => new PSPoint({x: 1} as any), /PSPoint/);
  });

  it('throws for missing x coordinate', () => {
    assert.throws(() => new PSPoint({y: 1} as any), /PSPoint/);
  });

  it('throws for non-number x coordinate', () => {
    assert.throws(() => new PSPoint({x: 'a' as any, y: 1}), /PSPoint/);
  });
});

describe('PSRect', () => {
  it('creates PS rect representation', () => {
    const ps = new PSRect({x: 1, y: 2, width: 100, height: 50});
    const str = ps.toString();
    assert.ok(str.includes('1'));
    assert.ok(str.includes('2'));
    assert.ok(str.includes('100'));
    assert.ok(str.includes('50'));
    assert.ok(str.includes('Rect'));
  });

  it('throws for incomplete rect (missing height)', () => {
    assert.throws(() => new PSRect({x: 1, y: 2, width: 100} as any), /PSRect/);
  });

  it('throws for non-number rect field', () => {
    assert.throws(() => new PSRect({x: 'a' as any, y: 2, width: 100, height: 50}), /PSRect/);
  });
});

describe('PSAutomationElement', () => {
  it('wraps a W3C element id', () => {
    const element = {[W3C_ELEMENT_KEY]: '1.2.3.4.5'};
    const ps = new PSAutomationElement(element);
    assert.equal(ps.toString(), '1.2.3.4.5');
  });

  it('throws if W3C element key is missing', () => {
    assert.throws(() => new PSAutomationElement({} as any), /PSAutomationElement/);
  });

  it('throws if W3C element key is empty string', () => {
    assert.throws(() => new PSAutomationElement({[W3C_ELEMENT_KEY]: ''} as any), /PSAutomationElement/);
  });
});

describe('PSCultureInfo', () => {
  it('creates from string name', () => {
    const ps = new PSCultureInfo('en-US');
    assert.ok(ps.toString().includes('en-US'));
    assert.ok(ps.toString().includes('CultureInfo'));
  });

  it('creates from integer culture ID', () => {
    const ps = new PSCultureInfo(1033);
    assert.ok(ps.toString().includes('1033'));
    assert.ok(ps.toString().includes('CultureInfo'));
  });

  it('throws for negative integer', () => {
    assert.throws(() => new PSCultureInfo(-1), /PSCultureInfo/);
  });

  it('throws for non-string non-number input', () => {
    assert.throws(() => new PSCultureInfo([] as any), /PSCultureInfo/);
    assert.throws(() => new PSCultureInfo(null as any), /PSCultureInfo/);
  });
});
