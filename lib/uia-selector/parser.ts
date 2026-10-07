import {errors} from 'appium/driver';
import {logger} from 'appium/support';

import {ConstructorRegexMatcher, PropertyRegexMatcher, RegexItem, VarArgsRegexMatcher} from '../powershell/regex';
import {
  AutomationElementProperty,
  AutomationHeadingLevel,
  AutomationHeadingLevelProperty,
  BooleanProperty,
  ControlType,
  ControlTypeProperty,
  CultureInfoProperty,
  ExtraControlType,
  Int32ArrayProperty,
  Int32Property,
  OrientationType,
  OrientationTypeProperty,
  PointProperty,
  Property,
  RectProperty,
  StringProperty,
} from '../powershell/types';
import {
  andCondition,
  falseCondition,
  notCondition,
  orCondition,
  propertyCondition,
  trueCondition,
} from '../server/conditions';
import type {ConditionDto} from '../server/protocol';

/**
 * Parser for the `-windows uiautomation` locator strategy.
 *
 * The selector syntax mirrors the System.Windows.Automation API as it would be written in
 * PowerShell or C# (`[PropertyCondition]::new([AutomationElement]::NameProperty, 'OK')`,
 * `[AndCondition]::new(...)`, `[Automation]::ControlViewCondition`, ...), but nothing is ever
 * executed: the selector is tokenised with regexes and turned straight into a ConditionDto
 * for WincoreServer.exe.
 *
 * Parsing works bottom-up. Every recognised literal or sub-expression is pushed onto `items`
 * and replaced in the working string by a single placeholder character (U+EE00 + index), so
 * later passes only ever see `...PropertyCondition]::new(<p0>, <p1>)`-shaped text. String
 * literals go first so their contents can never be mistaken for tokens.
 */

type Point = {x: number; y: number};
type Rect = Point & {width: number; height: number};

type SelectorValue =
  | {kind: 'string'; value: string}
  | {kind: 'int32'; value: number}
  | {kind: 'int32[]'; value: number[]}
  | {kind: 'point'; value: Point}
  | {kind: 'rect'; value: Rect}
  | {kind: 'controlType'; value: string}
  | {kind: 'orientation'; value: string}
  | {kind: 'headingLevel'; value: string}
  | {kind: 'culture'; value: string | number}
  | {kind: 'condition'; value: ConditionDto};

type ValueKind = SelectorValue['kind'] | 'boolean' | 'element';

const BOOLEAN_REGEX = /(?<=[\s,])(?:\$)?(true|false)(?=[\s)])/;
const INTEGER_REGEX = /((?<![\d.+-])[+-]?\d+(?![\d.]))/;
const POSITIVE_INTEGER_REGEX = /((?<![\d.+-])[+]?\d+(?![\d.]))/;
const FLOATING_POINT_NUMBER_REGEX = /((?<![\d.+-])[+-]?(?:\d*[.])?\d+(?![\d.]))/;
const POSITIVE_FLOATING_POINT_NUMBER_REGEX = /((?<![\d.+-])[+]?(?:\d*[.])?\d+(?![\d.]))/;
const PROCESSED_STRING_RESULT_MATCH_REGEX = /^[-]{1}$/;
const PROCESSED_ITEMS_REGEX = /[-]/g;

const BOOLEAN_MATCHER = new RegexItem(BOOLEAN_REGEX.source);
const INTEGER_MATCHER = new RegexItem(INTEGER_REGEX.source);
const POSITIVE_INTEGER_MATCHER = new RegexItem(POSITIVE_INTEGER_REGEX.source);
const FLOATING_POINT_NUMBER_MATCHER = new RegexItem(FLOATING_POINT_NUMBER_REGEX.source);
const POSITIVE_FLOATING_POINT_NUMBER_MATCHER = new RegexItem(POSITIVE_FLOATING_POINT_NUMBER_REGEX.source);
const PROCESSED_ITEM_REGEX_MATCHER = new RegexItem(`(${PROCESSED_ITEMS_REGEX.source}{1})`);
const POINT_REGEX_MATCHER = new ConstructorRegexMatcher(
  'System.Windows.Point',
  FLOATING_POINT_NUMBER_MATCHER,
  FLOATING_POINT_NUMBER_MATCHER,
);
const SIZE_REGEX_MATCHER = new ConstructorRegexMatcher(
  'System.Windows.Size',
  POSITIVE_FLOATING_POINT_NUMBER_MATCHER,
  POSITIVE_FLOATING_POINT_NUMBER_MATCHER,
);
const VECTOR_REGEX_MATCHER = new ConstructorRegexMatcher(
  'System.Windows.Vector',
  FLOATING_POINT_NUMBER_MATCHER,
  FLOATING_POINT_NUMBER_MATCHER,
);

const PROPERTY_CONDITION_REGEX = new ConstructorRegexMatcher(
  'System.Windows.Automation.Property(?:Condition)?',
  new PropertyRegexMatcher('System.Windows.Automation.AutomationElement'),
  PROCESSED_ITEM_REGEX_MATCHER,
).toRegex('gi');
const ANY_LOGIC_CONDITION_REGEX = new ConstructorRegexMatcher(
  'System.Windows.Automation.(?:And|Or|Not)(?:Condition)?',
  new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER),
).toRegex('i'); // not global as it will be used for test

const AND_CONDITION_REGEX = new ConstructorRegexMatcher(
  'System.Windows.Automation.And(?:Condition)?',
  new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER),
).toRegex('gi');
const OR_CONDITION_REGEX = new ConstructorRegexMatcher(
  'System.Windows.Automation.Or(?:Condition)?',
  new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER),
).toRegex('gi');
const NOT_CONDITION_REGEX = new ConstructorRegexMatcher(
  'System.Windows.Automation.Not(?:Condition)?',
  new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER),
).toRegex('gi');

const TRUE_CONDITION_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.(?:Property)Condition',
  `True(?:Condition)?`,
).toRegex('gi');
const FALSE_CONDITION_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.(?:Property)Condition',
  `False(?:Condition)?`,
).toRegex('gi');

const RAW_VIEW_CONDITION_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.Automation',
  `RawView(?:Condition)?`,
).toRegex('gi');
const CONTROL_VIEW_CONDITION_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.Automation',
  `ControlView(?:Condition)?`,
).toRegex('gi');
const CONTENT_VIEW_CONDITION_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.Automation',
  `ContentView(?:Condition)?`,
).toRegex('gi');

const POINT_PARAMETER_REGEX = POINT_REGEX_MATCHER.toRegex('gi');

// Rect(Point, Size)
const RECT_PARAMETER_REGEX_C1 = new ConstructorRegexMatcher(
  'System.Windows.Rect',
  POINT_REGEX_MATCHER,
  SIZE_REGEX_MATCHER,
).toRegex('gi');
// Rect(x, y, width, height)
const RECT_PARAMETER_REGEX_C2 = new ConstructorRegexMatcher(
  'System.Windows.Rect',
  FLOATING_POINT_NUMBER_MATCHER,
  FLOATING_POINT_NUMBER_MATCHER,
  FLOATING_POINT_NUMBER_MATCHER,
  FLOATING_POINT_NUMBER_MATCHER,
).toRegex('gi');
// Rect(Point, Point)
const RECT_PARAMETER_REGEX_C3 = new ConstructorRegexMatcher(
  'System.Windows.Rect',
  POINT_REGEX_MATCHER,
  POINT_REGEX_MATCHER,
).toRegex('gi');
// Rect(Point, Vector)
const RECT_PARAMETER_REGEX_C4 = new ConstructorRegexMatcher(
  'System.Windows.Rect',
  POINT_REGEX_MATCHER,
  VECTOR_REGEX_MATCHER,
).toRegex('gi');
// Rect(Size)
const RECT_PARAMETER_REGEX_C5 = new ConstructorRegexMatcher('System.Windows.Rect', SIZE_REGEX_MATCHER).toRegex('gi');

const AUTOMATION_HEADING_LEVEL_PARAMETER_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.AutomationHeadingLevel',
  ...Object.values(AutomationHeadingLevel),
).toRegex('gi');
const ORIENTATION_TYPE_PARAMETER_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.OrientationType',
  ...Object.values(OrientationType),
).toRegex('gi');
const CONTROL_TYPE_PARAMETER_REGEX = new PropertyRegexMatcher(
  'System.Windows.Automation.ControlType',
  ...Object.values(ControlType),
  ...Object.values(ExtraControlType),
).toRegex('gi');

// CultureInfo(name) — the name is a string literal, already replaced by a placeholder
const CULTURE_INFO_PARAMETER_REGEX_C1 = new ConstructorRegexMatcher(
  'System.Globalization.CultureInfo',
  PROCESSED_ITEM_REGEX_MATCHER,
).toRegex('gi');
// CultureInfo(name, useUserOverride)
const CULTURE_INFO_PARAMETER_REGEX_C2 = new ConstructorRegexMatcher(
  'System.Globalization.CultureInfo',
  PROCESSED_ITEM_REGEX_MATCHER,
  BOOLEAN_MATCHER,
).toRegex('gi');
// CultureInfo(culture)
const CULTURE_INFO_PARAMETER_REGEX_C3 = new ConstructorRegexMatcher(
  'System.Globalization.CultureInfo',
  POSITIVE_INTEGER_MATCHER,
).toRegex('gi');
// CultureInfo(culture, useUserOverride)
const CULTURE_INFO_PARAMETER_REGEX_C4 = new ConstructorRegexMatcher(
  'System.Globalization.CultureInfo',
  POSITIVE_INTEGER_MATCHER,
  BOOLEAN_MATCHER,
).toRegex('gi');

const INTEGER_PARAMETER_REGEX = INTEGER_MATCHER.toRegex('g');
const INTEGER_ARRAY_PARAMETER_REGEX =
  /(?:(?:(?:(?:new\s+)?\bint(?:32)?\[\])|(?:\[int(?:32)?\[\]\]))\s*)?(?:(?:@\((?=\s*\d+(?:\s*,\s*\d+)*\s*\)))|(?:\[(?=\s*\d+(?:\s*,\s*\d+)*\s*\]))|(?:\{(?=\s*\d+(?:\s*,\s*\d+)*\s*\})))\s*(\d+(?:\s*,\s*\d+)*)\s*(?:\)|\]|\})/gi;

// Backtick escapes recognised inside double-quoted strings (PowerShell semantics). Any other
// backtick-prefixed character stands for itself, so `" is a literal double quote.
const BACKTICK_ESCAPES: Record<string, string> = {
  '0': '\0',
  a: '\u0007',
  b: '\b',
  e: '\u001b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

const MAGIC_PLACEHOLDER_UNICODE_BEGIN = 0xee00;
const PROPERTY_SUFFIX = 'property';

const PROPERTY_VALUE_KINDS: [Record<string, string>, ValueKind][] = [
  [BooleanProperty, 'boolean'],
  [Int32Property, 'int32'],
  [StringProperty, 'string'],
  [Int32ArrayProperty, 'int32[]'],
  [PointProperty, 'point'],
  [RectProperty, 'rect'],
  [ControlTypeProperty, 'controlType'],
  [AutomationElementProperty, 'element'],
  [OrientationTypeProperty, 'orientation'],
  [AutomationHeadingLevelProperty, 'headingLevel'],
  [CultureInfoProperty, 'culture'],
];

const log = logger.getLogger('uia-selector');

class WindowsAutomationSelectorSyntaxError extends errors.InvalidSelectorError {
  constructor(selector: string, extraInfo?: string) {
    super(`Could not parse Windows Automation selector expression '${selector}'.${extraInfo ? ` ${extraInfo}.` : ''}`);
  }
}

/**
 * Parses a `-windows uiautomation` selector into the ConditionDto sent to WincoreServer.exe.
 *
 * @throws {errors.InvalidSelectorError} when the selector cannot be parsed or does not evaluate
 *   to a condition.
 * @throws {errors.InvalidArgumentError} when a property is unknown or given a value of the
 *   wrong type.
 */
export function parseUiaSelector(selector: string): ConditionDto {
  const items: SelectorValue[] = [];
  const push = (item: SelectorValue): string => {
    const placeholder = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + items.length);
    items.push(item);
    return placeholder;
  };
  const itemAt = (placeholder: string): SelectorValue | undefined =>
    items[placeholder.trim().charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN];

  // it's important to process the strings first as they can contain other tokens that may be matched later
  let processedSelector = replaceStringLiterals(selector, (value) => push({kind: 'string', value}));

  processedSelector = processedSelector.replaceAll(INTEGER_ARRAY_PARAMETER_REGEX, (_, value: string) =>
    push({kind: 'int32[]', value: value.split(',').map(Number)}),
  );

  // it's important to process Rect before Point as some of Rect's constructors contain Point or Points
  processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C1, (_, x, y, width, height) =>
    push({kind: 'rect', value: {x: Number(x), y: Number(y), width: Number(width), height: Number(height)}}),
  );

  processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C2, (_, x, y, width, height) =>
    push({kind: 'rect', value: {x: Number(x), y: Number(y), width: Number(width), height: Number(height)}}),
  );

  processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C3, (_, x1, y1, x2, y2) => {
    const [p1x, p1y, p2x, p2y] = [x1, y1, x2, y2].map(Number);
    return push({
      kind: 'rect',
      value: {x: Math.min(p1x, p2x), y: Math.min(p1y, p2y), width: Math.abs(p2x - p1x), height: Math.abs(p2y - p1y)},
    });
  });

  processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C4, (_, px, py, vx, vy) => {
    const [x, y, dx, dy] = [px, py, vx, vy].map(Number);
    return push({
      kind: 'rect',
      value: {x: dx < 0 ? x + dx : x, y: dy < 0 ? y + dy : y, width: Math.abs(dx), height: Math.abs(dy)},
    });
  });

  processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C5, (_, width, height) =>
    push({kind: 'rect', value: {x: 0, y: 0, width: Number(width), height: Number(height)}}),
  );

  processedSelector = processedSelector.replaceAll(POINT_PARAMETER_REGEX, (_, x: string, y: string) =>
    push({kind: 'point', value: {x: Number(x), y: Number(y)}}),
  );

  processedSelector = processedSelector.replaceAll(AUTOMATION_HEADING_LEVEL_PARAMETER_REGEX, (_, value: string) =>
    push({kind: 'headingLevel', value}),
  );

  processedSelector = processedSelector.replaceAll(ORIENTATION_TYPE_PARAMETER_REGEX, (_, value: string) =>
    push({kind: 'orientation', value}),
  );

  processedSelector = processedSelector.replaceAll(CONTROL_TYPE_PARAMETER_REGEX, (_, value: string) =>
    push({kind: 'controlType', value}),
  );

  const cultureName = (placeholder: string): string => {
    const item = itemAt(placeholder);
    if (item?.kind !== 'string') {
      throw new errors.InvalidArgumentError(`CultureInfo expects a culture name string, but got ${describe(item)}.`);
    }
    return item.value;
  };

  processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C1, (_, name: string) =>
    push({kind: 'culture', value: cultureName(name)}),
  );

  // useUserOverride only affects formatting, not which culture an element reports — dropped
  processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C2, (_, name: string) =>
    push({kind: 'culture', value: cultureName(name)}),
  );

  processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C3, (_, culture: string) =>
    push({kind: 'culture', value: Number(culture)}),
  );

  processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C4, (_, culture: string) =>
    push({kind: 'culture', value: Number(culture)}),
  );

  processedSelector = processedSelector.replaceAll(INTEGER_PARAMETER_REGEX, (match) =>
    push({kind: 'int32', value: Number(match)}),
  );

  processedSelector = processedSelector.replaceAll(TRUE_CONDITION_REGEX, () =>
    push({kind: 'condition', value: trueCondition()}),
  );

  processedSelector = processedSelector.replaceAll(FALSE_CONDITION_REGEX, () =>
    push({kind: 'condition', value: falseCondition()}),
  );

  processedSelector = processedSelector.replaceAll(RAW_VIEW_CONDITION_REGEX, () =>
    push({kind: 'condition', value: trueCondition()}),
  );

  processedSelector = processedSelector.replaceAll(CONTROL_VIEW_CONDITION_REGEX, () =>
    push({kind: 'condition', value: notCondition(propertyCondition(Property.IS_CONTROL_ELEMENT, false))}),
  );

  processedSelector = processedSelector.replaceAll(CONTENT_VIEW_CONDITION_REGEX, () =>
    push({
      kind: 'condition',
      value: notCondition(
        orCondition(
          propertyCondition(Property.IS_CONTROL_ELEMENT, false),
          propertyCondition(Property.IS_CONTENT_ELEMENT, false),
        ),
      ),
    }),
  );

  processedSelector = processedSelector.replaceAll(
    PROPERTY_CONDITION_REGEX,
    (_, property: string, processedItem: string) => {
      property = property.toLowerCase();

      if (property.endsWith(PROPERTY_SUFFIX)) {
        property = property.slice(0, property.length - PROPERTY_SUFFIX.length);
      }

      if (!Object.values(Property).includes(property as Property)) {
        throw new errors.InvalidArgumentError(`Unknown automation property '${property}'.`);
      }

      return push({kind: 'condition', value: buildPropertyCondition(property as Property, itemAt(processedItem))});
    },
  );

  const conditionArgs = (content: string): (SelectorValue | undefined)[] => content.split(',').map(itemAt);

  while (ANY_LOGIC_CONDITION_REGEX.test(processedSelector)) {
    processedSelector = processedSelector.replaceAll(AND_CONDITION_REGEX, (_, content: string) => {
      const args = conditionArgs(content);

      if (args.length < 2) {
        throw new WindowsAutomationSelectorSyntaxError(selector, 'expected AND condition to have at least 2 arguments');
      }

      return push({kind: 'condition', value: andCondition(...assertConditions('AndCondition', args))});
    });

    processedSelector = processedSelector.replaceAll(OR_CONDITION_REGEX, (_, content: string) => {
      const args = conditionArgs(content);

      if (args.length < 2) {
        throw new WindowsAutomationSelectorSyntaxError(selector, 'expected OR condition to have at least 2 arguments');
      }

      return push({kind: 'condition', value: orCondition(...assertConditions('OrCondition', args))});
    });

    processedSelector = processedSelector.replaceAll(NOT_CONDITION_REGEX, (_, content: string) => {
      const args = conditionArgs(content);

      if (args.length !== 1) {
        throw new WindowsAutomationSelectorSyntaxError(selector, 'expected NOT condition to have exactly 1 arguments');
      }

      return push({kind: 'condition', value: notCondition(assertConditions('NotCondition', args)[0])});
    });

    processedSelector = processedSelector.trim();
  }

  if (!PROCESSED_STRING_RESULT_MATCH_REGEX.test(processedSelector)) {
    throw new WindowsAutomationSelectorSyntaxError(
      selector,
      `Some parts of the selector were left unprocessed: '${processedSelector.replaceAll(PROCESSED_ITEMS_REGEX, '<processed>')}'`,
    );
  }

  const result = itemAt(processedSelector);

  if (result?.kind !== 'condition') {
    throw new WindowsAutomationSelectorSyntaxError(
      selector,
      'The selector must be of type System.Windows.Automation.Condition.',
    );
  }

  return result.value;
}

/**
 * Replaces every single- or double-quoted string literal with the placeholder returned by
 * `onString` for its unescaped value. A single linear left-to-right scan, so a quote inside
 * one kind of string never starts the other kind, and unterminated input cannot backtrack.
 *
 * Single-quoted: verbatim, `''` is an escaped quote. Double-quoted: `""` is an escaped quote and
 * backtick escapes apply (see BACKTICK_ESCAPES); `$` is literal (no variable expansion).
 * An unterminated literal is left in place, so it surfaces as an "unprocessed" syntax error.
 */
function replaceStringLiterals(selector: string, onString: (value: string) => string): string {
  let result = '';
  let i = 0;

  while (i < selector.length) {
    const quote = selector[i];
    if (quote !== `'` && quote !== `"`) {
      result += quote;
      i++;
      continue;
    }

    let value = '';
    let j = i + 1;
    let terminated = false;

    while (j < selector.length) {
      const char = selector[j];

      if (char === quote) {
        if (selector[j + 1] === quote) {
          value += quote;
          j += 2;
          continue;
        }
        terminated = true;
        j++;
        break;
      }

      if (quote === `"` && char === '`' && j + 1 < selector.length) {
        const escaped = selector[j + 1];
        value += BACKTICK_ESCAPES[escaped] ?? escaped;
        j += 2;
        continue;
      }

      value += char;
      j++;
    }

    if (!terminated) {
      return result + selector.slice(i);
    }

    result += onString(value);
    i = j;
  }

  return result;
}

function buildPropertyCondition(property: Property, value: SelectorValue | undefined): ConditionDto {
  const expected = PROPERTY_VALUE_KINDS.find(([group]) => Object.values(group).includes(property))?.[1];

  if (expected === 'orientation' && value?.kind !== 'orientation') {
    value = coerceEnumValue(property, value, 'orientation', Object.keys(AutomationHeadingLevel).length);
  } else if (expected === 'headingLevel' && value?.kind !== 'headingLevel') {
    value = coerceEnumValue(property, value, 'headingLevel', Object.keys(OrientationType).length);
  } else if (expected && value?.kind !== expected) {
    throw propertyTypeError(property, expected, value);
  }

  return propertyCondition(property, value?.value);
}

/**
 * `None` is tokenised as an AutomationHeadingLevel (that pass runs first), so it has to be
 * re-labelled when used for Orientation, and vice versa. A raw Int32 is accepted within the
 * given bound.
 */
function coerceEnumValue(
  property: Property,
  value: SelectorValue | undefined,
  expected: 'orientation' | 'headingLevel',
  int32Bound: number,
): SelectorValue {
  const otherKind = expected === 'orientation' ? 'headingLevel' : 'orientation';

  if (value?.kind === otherKind && value.value.toLowerCase() === OrientationType.NONE) {
    log.debug(`Coercing ${otherKind} 'None' to ${expected} 'none' for property '${property}'.`);
    return {kind: expected, value: OrientationType.NONE};
  }

  if (value?.kind === 'int32' && value.value >= 0 && value.value < int32Bound) {
    log.debug(`Accepting raw Int32 value ${value.value} for property '${property}'.`);
    return value;
  }

  throw propertyTypeError(property, expected, value);
}

function assertConditions(name: string, args: (SelectorValue | undefined)[]): ConditionDto[] {
  const conditions: ConditionDto[] = [];
  for (const arg of args) {
    if (arg?.kind !== 'condition') {
      throw new errors.InvalidArgumentError(`${name} expects Conditions as args but received ${describe(arg)}.`);
    }
    conditions.push(arg.value);
  }
  return conditions;
}

function propertyTypeError(property: string, expected: ValueKind, actual: SelectorValue | undefined): Error {
  return new errors.InvalidArgumentError(
    `Property '${property}' expects a value of type ${expected} but got ${describe(actual)}.`,
  );
}

function describe(value: SelectorValue | undefined): string {
  return value ? value.kind : 'nothing';
}
