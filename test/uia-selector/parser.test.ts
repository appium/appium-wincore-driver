/**
 * Unit tests for lib/uia-selector/parser.ts (parseUiaSelector)
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {errors} from 'appium/driver.js';

import {parseUiaSelector} from '../../lib/uia-selector/parser.js';

const P = (property: string, value: string) => `[PropertyCondition]::new([AutomationElement]::${property}, ${value})`;
const NAME = (value: string) => P('NameProperty', value);
const name = (value: string) => ({type: 'property', property: 'Name', value});

describe('parseUiaSelector', () => {
  describe('TrueCondition / FalseCondition', () => {
    it('parses PropertyCondition TrueCondition', () => {
      assert.deepEqual(parseUiaSelector('[PropertyCondition]::TrueCondition'), {type: 'true'});
    });

    it('parses PropertyCondition FalseCondition', () => {
      assert.deepEqual(parseUiaSelector('[PropertyCondition]::FalseCondition'), {type: 'false'});
    });

    it('parses Automation.RawViewCondition as TrueCondition', () => {
      assert.deepEqual(parseUiaSelector('[Automation]::RawViewCondition'), {type: 'true'});
    });
  });

  describe('PropertyCondition', () => {
    it('parses name property condition with string value', () => {
      assert.deepEqual(parseUiaSelector(NAME(`'Calculator'`)), name('Calculator'));
    });

    it('parses integer property condition (native window handle)', () => {
      assert.deepEqual(parseUiaSelector(P('NativeWindowHandleProperty', '12345')), {
        type: 'property',
        property: 'NativeWindowHandle',
        value: 12345,
      });
    });

    it('parses control type property condition', () => {
      assert.deepEqual(parseUiaSelector(P('ControlTypeProperty', '[ControlType]::Button')), {
        type: 'property',
        property: 'ControlType',
        value: 'Button',
      });
    });

    it('sends SemanticZoom / AppBar control types by name', () => {
      assert.deepEqual(parseUiaSelector(P('ControlTypeProperty', 'SemanticZoom')), {
        type: 'property',
        property: 'ControlType',
        value: 'SemanticZoom',
      });
      assert.deepEqual(parseUiaSelector(P('ControlTypeProperty', '[ControlType]::AppBar')), {
        type: 'property',
        property: 'ControlType',
        value: 'AppBar',
      });
    });

    it('parses automation id property condition', () => {
      assert.deepEqual(parseUiaSelector(P('AutomationIdProperty', `'btn_ok'`)), {
        type: 'property',
        property: 'AutomationId',
        value: 'btn_ok',
      });
    });

    it('accepts the property name without the Property suffix', () => {
      assert.deepEqual(parseUiaSelector(`[PropertyCondition]::new([AutomationElement]::Name, 'a')`), name('a'));
    });

    it('coerces None to the enum the property expects', () => {
      assert.deepEqual(parseUiaSelector(P('OrientationProperty', 'None')), {
        type: 'property',
        property: 'Orientation',
        value: 'none',
      });
    });

    it('sends Point values as structured JSON', () => {
      assert.deepEqual(parseUiaSelector(P('ClickablePointProperty', '[System.Windows.Point]::new(1, -2.5)')), {
        type: 'property',
        property: 'ClickablePoint',
        value: {x: 1, y: -2.5},
      });
    });

    it('rejects BoundingRectangle with a clear error', () => {
      for (const selector of [
        P('BoundingRectangleProperty', '[Rect]::new(1, 2, 3, 4)'),
        P('BoundingRectangleProperty', '[Rect]::new([Point]::new(1, 2), [Size]::new(3, 4))'),
        P('boundingrectangle', `'x'`),
      ]) {
        assert.throws(
          () => parseUiaSelector(selector),
          (e: Error) =>
            e instanceof errors.InvalidSelectorError && e.message.includes('BoundingRectangle is not supported'),
        );
      }
    });

    it('does not mistake a string value for the BoundingRectangle property', () => {
      assert.deepEqual(parseUiaSelector(NAME(`'BoundingRectangleProperty'`)), name('BoundingRectangleProperty'));
    });

    it('sends CultureInfo as its name or LCID', () => {
      for (const culture of [`[CultureInfo]::new('en-US')`, `[CultureInfo]::new('en-US', $true)`]) {
        assert.deepEqual(parseUiaSelector(P('CultureProperty', culture)), {
          type: 'property',
          property: 'Culture',
          value: 'en-US',
        });
      }
      assert.deepEqual(parseUiaSelector(P('CultureProperty', '[CultureInfo]::new(1033)')), {
        type: 'property',
        property: 'Culture',
        value: 1033,
      });
    });

    it('throws InvalidArgumentError for unknown property name', () => {
      assert.throws(() => parseUiaSelector(P('UnknownProp', `'value'`)), errors.InvalidArgumentError);
    });

    it('throws InvalidArgumentError when a value has the wrong type', () => {
      assert.throws(() => parseUiaSelector(NAME('42')), errors.InvalidArgumentError);
      assert.throws(() => parseUiaSelector(P('NativeWindowHandleProperty', `'42'`)), errors.InvalidArgumentError);
      assert.throws(() => parseUiaSelector(P('IsEnabledProperty', `'true'`)), errors.InvalidArgumentError);
      assert.throws(() => parseUiaSelector(P('ControlTypeProperty', `'Button'`)), errors.InvalidArgumentError);
      assert.throws(() => parseUiaSelector(P('LabeledByProperty', `'x'`)), errors.InvalidArgumentError);
    });
  });

  describe('accepted spellings', () => {
    for (const selector of [
      `[PropertyCondition]::new(NameProperty, 'a')`,
      `[PropertyCondition]::new(AutomationElement.NameProperty, 'a')`,
      `[PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'a')`,
      `[PropertyCondition]::new([automationelement]::nameproperty, 'a')`,
      `[PROPERTYCONDITION]::NEW([AUTOMATIONELEMENT]::NAMEPROPERTY, 'a')`,
      `[System.Windows.Automation.PropertyCondition]::new([AutomationElement]::NameProperty, 'a')`,
      `[Automation.PropertyCondition]::new([AutomationElement]::NameProperty, 'a')`,
      `[Property]::new([AutomationElement]::NameProperty, 'a')`,
      `new PropertyCondition(AutomationElement.NameProperty, 'a')`,
      `PropertyCondition(NameProperty, 'a')`,
      `[PropertyCondition]::new([AutomationElement]::NameProperty,'a')`,
    ]) {
      it(`parses ${selector}`, () => {
        assert.deepEqual(parseUiaSelector(selector), name('a'));
      });
    }

    for (const controlType of [
      'Button',
      'BUTTON',
      '[ControlType]::BUTTON',
      '[System.Windows.Automation.ControlType]::button',
    ]) {
      it(`parses control type ${controlType}`, () => {
        const {value} = parseUiaSelector(P('ControlTypeProperty', controlType)) as {value: string};
        assert.equal(value.toLowerCase(), 'button');
      });
    }

    for (const runtimeId of [
      '@(42, 1)',
      '[int[]] @(42, 1)',
      '[int32[]]@(42,1)',
      'new int[] {42, 1}',
      'int32[] [ 42 , 1 ]',
      '{42, 1}',
    ]) {
      it(`parses integer array ${runtimeId}`, () => {
        assert.deepEqual(parseUiaSelector(P('RuntimeIdProperty', runtimeId)), {
          type: 'property',
          property: 'RuntimeId',
          value: [42, 1],
        });
      });
    }

    for (const selector of ['TrueCondition']) {
      it(`parses ${selector}`, () => {
        assert.deepEqual(parseUiaSelector(selector), {type: 'true'});
      });
    }

    for (const selector of [
      `new AndCondition(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
      `[And]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
      `[System.Windows.Automation.AndCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
      `[AndCondition]::new(\n  ${NAME(`'A'`)},\n  ${NAME(`'B'`)}\n)`,
    ]) {
      it(`parses ${selector}`, () => {
        assert.deepEqual(parseUiaSelector(selector), {type: 'and', conditions: [name('A'), name('B')]});
      });
    }
  });

  describe('AndCondition', () => {
    it('parses AND condition with two property conditions', () => {
      assert.deepEqual(parseUiaSelector(`[AndCondition]::new(${NAME(`'Calc'`)}, ${NAME(`'Test'`)})`), {
        type: 'and',
        conditions: [name('Calc'), name('Test')],
      });
    });

    it('parses AND condition with three conditions', () => {
      assert.deepEqual(parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}, ${NAME(`'C'`)})`), {
        type: 'and',
        conditions: [name('A'), name('B'), name('C')],
      });
    });

    it('throws InvalidSelectorError with fewer than 2 conditions', () => {
      assert.throws(() => parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)})`), errors.InvalidSelectorError);
    });

    it('throws InvalidArgumentError for a non-condition argument', () => {
      assert.throws(() => parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)}, 'B')`), errors.InvalidArgumentError);
    });
  });

  describe('OrCondition', () => {
    it('parses OR condition', () => {
      assert.deepEqual(parseUiaSelector(`[OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`), {
        type: 'or',
        conditions: [name('A'), name('B')],
      });
    });

    it('throws InvalidSelectorError with fewer than 2 conditions', () => {
      assert.throws(() => parseUiaSelector(`[OrCondition]::new(${NAME(`'A'`)})`), errors.InvalidSelectorError);
    });
  });

  describe('NotCondition', () => {
    it('parses NOT condition', () => {
      assert.deepEqual(parseUiaSelector(`[NotCondition]::new(${NAME(`'test'`)})`), {
        type: 'not',
        condition: name('test'),
      });
    });

    it('throws InvalidSelectorError with more than one argument', () => {
      assert.throws(
        () => parseUiaSelector(`[NotCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`),
        errors.InvalidSelectorError,
      );
    });

    it('throws InvalidArgumentError for a non-condition argument', () => {
      assert.throws(() => parseUiaSelector(`[NotCondition]::new('A')`), errors.InvalidArgumentError);
    });
  });

  it('parses nested logical conditions', () => {
    assert.deepEqual(
      parseUiaSelector(
        `[AndCondition]::new([OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}), [NotCondition]::new([PropertyCondition]::TrueCondition))`,
      ),
      {
        type: 'and',
        conditions: [
          {type: 'or', conditions: [name('A'), name('B')]},
          {type: 'not', condition: {type: 'true'}},
        ],
      },
    );
  });

  describe('ControlView / ContentView conditions', () => {
    it('parses ControlViewCondition as NOT IsControlElement=false', () => {
      assert.deepEqual(parseUiaSelector('[Automation]::ControlViewCondition'), {
        type: 'not',
        condition: {type: 'property', property: 'IsControlElement', value: false},
      });
    });

    it('parses ContentViewCondition as NOT (IsControlElement=false OR IsContentElement=false)', () => {
      assert.deepEqual(parseUiaSelector('[Automation]::ContentViewCondition'), {
        type: 'not',
        condition: {
          type: 'or',
          conditions: [
            {type: 'property', property: 'IsControlElement', value: false},
            {type: 'property', property: 'IsContentElement', value: false},
          ],
        },
      });
    });
  });

  describe('integer array property condition', () => {
    it('parses runtime id condition with integer array', () => {
      assert.deepEqual(parseUiaSelector(P('RuntimeIdProperty', '[int32[]] @(1, 2, 3)')), {
        type: 'property',
        property: 'RuntimeId',
        value: [1, 2, 3],
      });
    });
  });

  describe('error handling', () => {
    it('throws InvalidSelectorError for an unrecognized selector', () => {
      assert.throws(() => parseUiaSelector('not a valid selector'), errors.InvalidSelectorError);
    });

    it('throws InvalidSelectorError for empty string', () => {
      assert.throws(() => parseUiaSelector(''), errors.InvalidSelectorError);
    });

    it('throws InvalidSelectorError when result is not a Condition', () => {
      assert.throws(() => parseUiaSelector('42'), {
        message: /The selector must be of type System\.Windows\.Automation\.Condition\./,
      });
    });

    for (const selector of [
      '   ',
      `'just a string'`,
      '[ControlType]::Button',
      '@(1, 2)',
      '[PropertyCondition]::new([AutomationElement]::NameProperty)',
      `[PropertyCondition]::new([AutomationElement]::NameProperty, 'a', 'b')`,
      `${NAME(`'a'`)} ${NAME(`'b'`)}`,
      `[AndCondition]::new()`,
      `[FooCondition]::new(${NAME(`'a'`)})`,
      NAME(`'unterminated`),
      NAME(`"unterminated`),
    ]) {
      it(`throws InvalidSelectorError for ${selector.trim() || 'blank input'}`, () => {
        assert.throws(() => parseUiaSelector(selector), errors.InvalidSelectorError);
      });
    }

    it('reports the unprocessed remainder', () => {
      assert.throws(() => parseUiaSelector(`${NAME(`'a'`)} trailing`), {
        message: /Some parts of the selector were left unprocessed: '<processed> trailing'/,
      });
    });
  });

  describe('single-quoted strings', () => {
    it('keeps non-ASCII text and separators inside a string', () => {
      for (const value of ['שורות', '日本語 🎉', 'a,b', 'a)b', '@(1, 2)', '42', 'TrueCondition']) {
        assert.deepEqual(parseUiaSelector(NAME(`'${value}'`)), name(value));
      }
    });

    it('handles escaped single quotes', () => {
      assert.deepEqual(parseUiaSelector(NAME(`'it''s'`)), name("it's"));
    });

    it('unescapes every doubled single quote, not just the first', () => {
      assert.deepEqual(parseUiaSelector(NAME(`'it''s a ''b'''`)), name("it's a 'b'"));
    });

    it('keeps special characters, double quotes and backticks verbatim', () => {
      assert.deepEqual(parseUiaSelector(NAME(`'hello world'`)), name('hello world'));
      assert.deepEqual(parseUiaSelector(NAME(`'say "hi" \`n $x'`)), name('say "hi" `n $x'));
    });

    it('does not tokenise string contents', () => {
      assert.deepEqual(
        parseUiaSelector(NAME(`'[ControlType]::Button, 42 TrueCondition)'`)),
        name('[ControlType]::Button, 42 TrueCondition)'),
      );
    });
  });

  describe('double-quoted strings', () => {
    it('parses a plain double-quoted string', () => {
      assert.deepEqual(parseUiaSelector(NAME(`"Calculator"`)), name('Calculator'));
      assert.deepEqual(parseUiaSelector(NAME(`""`)), name(''));
    });

    it('treats "" and `" as an escaped double quote', () => {
      assert.deepEqual(parseUiaSelector(NAME(`"a""b"`)), name('a"b'));
      assert.deepEqual(parseUiaSelector(NAME('"a`"b"')), name('a"b'));
    });

    it('applies backtick escapes; other backtick pairs yield the character', () => {
      assert.deepEqual(parseUiaSelector(NAME('"a`tb`nc`0d``e`$f`qg`eh"')), name('a\tb\nc\0d`e$fqg\u001bh'));
    });

    it('keeps single quotes and $ verbatim (no variable expansion)', () => {
      assert.deepEqual(parseUiaSelector(NAME(`"it's $name"`)), name("it's $name"));
    });
  });

  describe('boolean values', () => {
    it('accepts $true / $false / bare true / false for boolean properties', () => {
      const isEnabled = (value: boolean) => ({type: 'property', property: 'IsEnabled', value});
      assert.deepEqual(parseUiaSelector(P('IsEnabledProperty', '$true')), isEnabled(true));
      assert.deepEqual(parseUiaSelector(P('IsEnabledProperty', '$false')), isEnabled(false));
      assert.deepEqual(parseUiaSelector(P('IsEnabledProperty', 'true')), isEnabled(true));
      assert.deepEqual(parseUiaSelector(P('IsEnabledProperty', 'FALSE')), isEnabled(false));
    });

    it('rejects a boolean for a non-boolean property', () => {
      assert.throws(() => parseUiaSelector(NAME('$true')), errors.InvalidArgumentError);
    });

    it('keeps bare true as TrueCondition outside a property condition', () => {
      assert.deepEqual(parseUiaSelector('[NotCondition]::new(true)'), {type: 'not', condition: {type: 'true'}});
    });
  });

  describe('raw Int32 enum values', () => {
    it('bounds Orientation to 0..2', () => {
      assert.deepEqual(parseUiaSelector(P('OrientationProperty', '2')), {
        type: 'property',
        property: 'Orientation',
        value: 2,
      });
      assert.throws(() => parseUiaSelector(P('OrientationProperty', '3')), errors.InvalidArgumentError);
    });

    it('bounds HeadingLevel to 0..9', () => {
      assert.deepEqual(parseUiaSelector(P('HeadingLevelProperty', '9')), {
        type: 'property',
        property: 'HeadingLevel',
        value: 9,
      });
      assert.throws(() => parseUiaSelector(P('HeadingLevelProperty', '10')), errors.InvalidArgumentError);
    });
  });

  describe('selector size limit', () => {
    const orOf = (count: number) =>
      `[OrCondition]::new(${Array.from({length: count}, (_, i) => NAME(`'n${i}'`)).join(', ')})`;

    it('parses a selector that fits the placeholder range', () => {
      assert.equal((parseUiaSelector(orOf(255)) as {conditions: unknown[]}).conditions.length, 255);
    });

    it('reports a selector that does not fit as too large', () => {
      assert.throws(
        () => parseUiaSelector(orOf(256)),
        (e: Error) => e instanceof errors.InvalidSelectorError && e.message.includes('at most 512 values'),
      );
    });
  });

  describe('ReDoS', () => {
    for (const [label, selector] of [
      ['double-quoted', `[Name] -eq "${'!'.repeat(50_000)}`],
      ['single-quoted', `[Name] -eq '${'a'.repeat(50_000)}`],
      ['backtick run', `[Name] -eq "${'`!'.repeat(25_000)}`],
      ['doubled quotes', `[Name] -eq '${"''".repeat(25_000)}`],
    ]) {
      it(`rejects an unterminated ${label} string in linear time`, () => {
        const start = performance.now();
        assert.throws(() => parseUiaSelector(selector), errors.InvalidSelectorError);
        assert.ok(performance.now() - start < 500);
      });
    }
  });
});
