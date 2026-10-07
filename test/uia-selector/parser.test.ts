/**
 * Unit tests for lib/uia-selector/parser.ts (parseUiaSelector)
 */
import {errors} from 'appium/driver';
import {describe, it, expect} from 'vitest';

import {parseUiaSelector} from '../../lib/uia-selector/parser';

const P = (property: string, value: string) => `[PropertyCondition]::new([AutomationElement]::${property}, ${value})`;
const NAME = (value: string) => P('NameProperty', value);
const name = (value: string) => ({type: 'property', property: 'Name', value});

describe('parseUiaSelector', () => {
  describe('TrueCondition / FalseCondition', () => {
    it('parses PropertyCondition TrueCondition', () => {
      expect(parseUiaSelector('[PropertyCondition]::TrueCondition')).toEqual({type: 'true'});
    });

    it('parses PropertyCondition FalseCondition', () => {
      expect(parseUiaSelector('[PropertyCondition]::FalseCondition')).toEqual({type: 'false'});
    });

    it('parses Automation.RawViewCondition as TrueCondition', () => {
      expect(parseUiaSelector('[Automation]::RawViewCondition')).toEqual({type: 'true'});
    });
  });

  describe('PropertyCondition', () => {
    it('parses name property condition with string value', () => {
      expect(parseUiaSelector(NAME(`'Calculator'`))).toEqual(name('Calculator'));
    });

    it('parses integer property condition (native window handle)', () => {
      expect(parseUiaSelector(P('NativeWindowHandleProperty', '12345'))).toEqual({
        type: 'property',
        property: 'NativeWindowHandle',
        value: 12345,
      });
    });

    it('parses control type property condition', () => {
      expect(parseUiaSelector(P('ControlTypeProperty', '[ControlType]::Button'))).toEqual({
        type: 'property',
        property: 'ControlType',
        value: 'Button',
      });
    });

    it('sends SemanticZoom / AppBar control types by name', () => {
      expect(parseUiaSelector(P('ControlTypeProperty', 'SemanticZoom'))).toEqual({
        type: 'property',
        property: 'ControlType',
        value: 'SemanticZoom',
      });
    });

    it('parses automation id property condition', () => {
      expect(parseUiaSelector(P('AutomationIdProperty', `'btn_ok'`))).toEqual({
        type: 'property',
        property: 'AutomationId',
        value: 'btn_ok',
      });
    });

    it('accepts the property name without the Property suffix', () => {
      expect(parseUiaSelector(`[PropertyCondition]::new([AutomationElement]::Name, 'a')`)).toEqual(name('a'));
    });

    it('coerces None to the enum the property expects', () => {
      expect(parseUiaSelector(P('OrientationProperty', 'None'))).toEqual({
        type: 'property',
        property: 'Orientation',
        value: 'none',
      });
    });

    it('sends Point and Rect values as structured JSON', () => {
      expect(parseUiaSelector(P('ClickablePointProperty', '[System.Windows.Point]::new(1, -2.5)'))).toEqual({
        type: 'property',
        property: 'ClickablePoint',
        value: {x: 1, y: -2.5},
      });
      expect(
        parseUiaSelector(P('BoundingRectangleProperty', '[Rect]::new([Point]::new(5, 6), [Point]::new(1, 2))')),
      ).toEqual({type: 'property', property: 'BoundingRectangle', value: {x: 1, y: 2, width: 4, height: 4}});
    });

    it('sends CultureInfo as its name or LCID', () => {
      expect(parseUiaSelector(P('CultureProperty', `[CultureInfo]::new('en-US', $true)`))).toEqual({
        type: 'property',
        property: 'Culture',
        value: 'en-US',
      });
      expect(parseUiaSelector(P('CultureProperty', '[CultureInfo]::new(1033)'))).toEqual({
        type: 'property',
        property: 'Culture',
        value: 1033,
      });
    });

    it('throws InvalidArgumentError for unknown property name', () => {
      expect(() => parseUiaSelector(P('UnknownProp', `'value'`))).toThrow(errors.InvalidArgumentError);
    });

    it('throws InvalidArgumentError when a value has the wrong type', () => {
      expect(() => parseUiaSelector(NAME('42'))).toThrow(errors.InvalidArgumentError);
      expect(() => parseUiaSelector(P('NativeWindowHandleProperty', `'42'`))).toThrow(errors.InvalidArgumentError);
      expect(() => parseUiaSelector(P('IsEnabledProperty', `'true'`))).toThrow(errors.InvalidArgumentError);
      expect(() => parseUiaSelector(P('ControlTypeProperty', `'Button'`))).toThrow(errors.InvalidArgumentError);
      expect(() => parseUiaSelector(P('LabeledByProperty', `'x'`))).toThrow(errors.InvalidArgumentError);
    });
  });

  describe('AndCondition', () => {
    it('parses AND condition with two property conditions', () => {
      expect(parseUiaSelector(`[AndCondition]::new(${NAME(`'Calc'`)}, ${NAME(`'Test'`)})`)).toEqual({
        type: 'and',
        conditions: [name('Calc'), name('Test')],
      });
    });

    it('parses AND condition with three conditions', () => {
      expect(parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}, ${NAME(`'C'`)})`)).toEqual({
        type: 'and',
        conditions: [name('A'), name('B'), name('C')],
      });
    });

    it('throws InvalidSelectorError with fewer than 2 conditions', () => {
      expect(() => parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)})`)).toThrow(errors.InvalidSelectorError);
    });

    it('throws InvalidArgumentError for a non-condition argument', () => {
      expect(() => parseUiaSelector(`[AndCondition]::new(${NAME(`'A'`)}, 'B')`)).toThrow(errors.InvalidArgumentError);
    });
  });

  describe('OrCondition', () => {
    it('parses OR condition', () => {
      expect(parseUiaSelector(`[OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`)).toEqual({
        type: 'or',
        conditions: [name('A'), name('B')],
      });
    });

    it('throws InvalidSelectorError with fewer than 2 conditions', () => {
      expect(() => parseUiaSelector(`[OrCondition]::new(${NAME(`'A'`)})`)).toThrow(errors.InvalidSelectorError);
    });
  });

  describe('NotCondition', () => {
    it('parses NOT condition', () => {
      expect(parseUiaSelector(`[NotCondition]::new(${NAME(`'test'`)})`)).toEqual({
        type: 'not',
        condition: name('test'),
      });
    });

    it('throws InvalidSelectorError with more than one argument', () => {
      expect(() => parseUiaSelector(`[NotCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`)).toThrow(
        errors.InvalidSelectorError,
      );
    });

    it('throws InvalidArgumentError for a non-condition argument', () => {
      expect(() => parseUiaSelector(`[NotCondition]::new('A')`)).toThrow(errors.InvalidArgumentError);
    });
  });

  it('parses nested logical conditions', () => {
    expect(
      parseUiaSelector(
        `[AndCondition]::new([OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}), [NotCondition]::new([PropertyCondition]::TrueCondition))`,
      ),
    ).toEqual({
      type: 'and',
      conditions: [
        {type: 'or', conditions: [name('A'), name('B')]},
        {type: 'not', condition: {type: 'true'}},
      ],
    });
  });

  describe('ControlView / ContentView conditions', () => {
    it('parses ControlViewCondition as NOT IsControlElement=false', () => {
      expect(parseUiaSelector('[Automation]::ControlViewCondition')).toEqual({
        type: 'not',
        condition: {type: 'property', property: 'IsControlElement', value: false},
      });
    });

    it('parses ContentViewCondition as NOT (IsControlElement=false OR IsContentElement=false)', () => {
      expect(parseUiaSelector('[Automation]::ContentViewCondition')).toEqual({
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
      expect(parseUiaSelector(P('RuntimeIdProperty', '[int32[]] @(1, 2, 3)'))).toEqual({
        type: 'property',
        property: 'RuntimeId',
        value: [1, 2, 3],
      });
    });
  });

  describe('error handling', () => {
    it('throws InvalidSelectorError for an unrecognized selector', () => {
      expect(() => parseUiaSelector('not a valid selector')).toThrow(errors.InvalidSelectorError);
    });

    it('throws InvalidSelectorError for empty string', () => {
      expect(() => parseUiaSelector('')).toThrow(errors.InvalidSelectorError);
    });

    it('throws InvalidSelectorError when result is not a Condition', () => {
      expect(() => parseUiaSelector('42')).toThrow('The selector must be of type System.Windows.Automation.Condition.');
    });

    it('reports the unprocessed remainder', () => {
      expect(() => parseUiaSelector(`${NAME(`'a'`)} trailing`)).toThrow(
        "Some parts of the selector were left unprocessed: '<processed> trailing'",
      );
    });
  });

  describe('single-quoted strings', () => {
    it('handles escaped single quotes', () => {
      expect(parseUiaSelector(NAME(`'it''s'`))).toEqual(name("it's"));
    });

    it('unescapes every doubled single quote, not just the first', () => {
      expect(parseUiaSelector(NAME(`'it''s a ''b'''`))).toEqual(name("it's a 'b'"));
    });

    it('keeps special characters, double quotes and backticks verbatim', () => {
      expect(parseUiaSelector(NAME(`'hello world'`))).toEqual(name('hello world'));
      expect(parseUiaSelector(NAME(`'say "hi" \`n $x'`))).toEqual(name('say "hi" `n $x'));
    });

    it('does not tokenise string contents', () => {
      expect(parseUiaSelector(NAME(`'[ControlType]::Button, 42 TrueCondition)'`))).toEqual(
        name('[ControlType]::Button, 42 TrueCondition)'),
      );
    });
  });

  describe('double-quoted strings', () => {
    it('parses a plain double-quoted string', () => {
      expect(parseUiaSelector(NAME(`"Calculator"`))).toEqual(name('Calculator'));
      expect(parseUiaSelector(NAME(`""`))).toEqual(name(''));
    });

    it('treats "" and `" as an escaped double quote', () => {
      expect(parseUiaSelector(NAME(`"a""b"`))).toEqual(name('a"b'));
      expect(parseUiaSelector(NAME('"a`"b"'))).toEqual(name('a"b'));
    });

    it('applies backtick escapes; other backtick pairs yield the character', () => {
      expect(parseUiaSelector(NAME('"a`tb`nc`0d``e`$f`qg`eh"'))).toEqual(name('a\tb\nc\0d`e$fqg\u001bh'));
    });

    it('keeps single quotes and $ verbatim (no variable expansion)', () => {
      expect(parseUiaSelector(NAME(`"it's $name"`))).toEqual(name("it's $name"));
    });
  });

  describe('ReDoS', () => {
    it.each([
      ['double-quoted', `[Name] -eq "${'!'.repeat(50_000)}`],
      ['single-quoted', `[Name] -eq '${'a'.repeat(50_000)}`],
      ['backtick run', `[Name] -eq "${'`!'.repeat(25_000)}`],
      ['doubled quotes', `[Name] -eq '${"''".repeat(25_000)}`],
    ])('rejects an unterminated %s string in linear time', (_, selector) => {
      const start = performance.now();
      expect(() => parseUiaSelector(selector)).toThrow(errors.InvalidSelectorError);
      expect(performance.now() - start).toBeLessThan(500);
    });
  });
});
