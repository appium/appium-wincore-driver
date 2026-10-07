/**
 * Broad set of `-windows uiautomation` selectors used to check that the DTO parser
 * (lib/uia-selector/parser.ts) behaves like the PowerShell-object pipeline it replaced.
 */
import {AutomationHeadingLevel, ControlType, OrientationType, Property} from '@/powershell/types';

const P = (property: string, value: string) => `[PropertyCondition]::new([AutomationElement]::${property}, ${value})`;
const NAME = (value: string) => P('NameProperty', value);

const VALUE_SAMPLES = [
  `'text'`,
  `42`,
  `-7`,
  `@(1, 2, 3)`,
  `[ControlType]::Button`,
  `[OrientationType]::Horizontal`,
  `[AutomationHeadingLevel]::Level2`,
  `None`,
  `[Condition]::TrueCondition`,
];

// every property against a representative value of every kind
const PROPERTY_MATRIX = Object.values(Property).flatMap((property) =>
  VALUE_SAMPLES.map((value) => P(`${property}Property`, value)),
);

const CONTROL_TYPES = Object.values(ControlType).flatMap((ct) => [
  P('ControlTypeProperty', ct),
  P('ControlTypeProperty', `[ControlType]::${ct.toUpperCase()}`),
  P('ControlTypeProperty', `[System.Windows.Automation.ControlType]::${ct}`),
  P('ControlTypeProperty', `ControlType.${ct}`),
]);

const ENUMS = [
  ...Object.values(OrientationType).flatMap((o) => [
    P('OrientationProperty', o),
    P('OrientationProperty', `[OrientationType]::${o}`),
    P('HeadingLevelProperty', `[OrientationType]::${o}`),
  ]),
  ...Object.values(AutomationHeadingLevel).flatMap((h) => [
    P('HeadingLevelProperty', h),
    P('HeadingLevelProperty', `[System.Windows.Automation.AutomationHeadingLevel]::${h}`),
    P('OrientationProperty', `AutomationHeadingLevel.${h}`),
  ]),
  ...[-1, 0, 1, 2, 3, 9, 10].flatMap((n) => [P('OrientationProperty', `${n}`), P('HeadingLevelProperty', `${n}`)]),
];

const PROPERTY_SPELLINGS = [
  `[PropertyCondition]::new([AutomationElement]::NameProperty, 'a')`,
  `[PropertyCondition]::new([AutomationElement]::Name, 'a')`,
  `[PropertyCondition]::new(NameProperty, 'a')`,
  `[PropertyCondition]::new(AutomationElement.NameProperty, 'a')`,
  `[PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'a')`,
  `[PropertyCondition]::new([automationelement]::nameproperty, 'a')`,
  `[PROPERTYCONDITION]::NEW([AUTOMATIONELEMENT]::NAMEPROPERTY, 'a')`,
  `[System.Windows.Automation.PropertyCondition]::new([AutomationElement]::NameProperty, 'a')`,
  `[Automation.PropertyCondition]::new([AutomationElement]::NameProperty, 'a')`,
  `[Property]::new([AutomationElement]::NameProperty, 'a')`,
  `new PropertyCondition(AutomationElement.NameProperty, 'a')`,
  `New-Object PropertyCondition([AutomationElement]::NameProperty, 'a')`,
  `New-Object System.Windows.Automation.PropertyCondition(NameProperty, 'a')`,
  `PropertyCondition(NameProperty, 'a')`,
  `  [PropertyCondition]::new(  [AutomationElement]::NameProperty  ,   'a'  )  `,
  `[PropertyCondition]::new([AutomationElement]::NameProperty,'a')`,
  `[PropertyCondition]::new([AutomationElement]::AutomationIdProperty, 'btn_ok')`,
  `[PropertyCondition]::new([AutomationElement]::ClassNameProperty, 'Button')`,
  `[PropertyCondition]::new([AutomationElement]::JavaClassProperty, 'javax.swing.JButton')`,
  `[PropertyCondition]::new([AutomationElement]::IsInvokePatternAvailableProperty, 'x')`,
];

const STRINGS = [
  NAME(`''`),
  NAME(`'hello world'`),
  NAME(`'it''s'`),
  NAME(`'Calculator'`),
  NAME(`'שורות'`),
  NAME(`'日本語 🎉'`),
  NAME(`'a,b'`),
  NAME(`'a)b'`),
  NAME(`'[ControlType]::Button'`),
  NAME(`'TrueCondition'`),
  NAME(`'42'`),
  NAME(`'@(1, 2)'`),
  NAME(`'line1\nline2'`),
  NAME(`'back\`tick'`),
  NAME(`'$x'`),
  NAME(`'unterminated`),
  NAME(`"unterminated`),
];

const VALUE_FORMS = [
  P('NativeWindowHandleProperty', '0'),
  P('NativeWindowHandleProperty', '+12345'),
  P('ProcessIdProperty', '-5'),
  P('ProcessIdProperty', '1.5'),
  P('SizeOfSetProperty', '3'),
  P('RuntimeIdProperty', '@(42, 1, 7)'),
  P('RuntimeIdProperty', '@(42)'),
  P('RuntimeIdProperty', '[int[]] @(42, 1)'),
  P('RuntimeIdProperty', '[int32[]]@(42,1)'),
  P('RuntimeIdProperty', 'new int[] {42, 1}'),
  P('RuntimeIdProperty', 'int32[] [ 42 , 1 ]'),
  P('RuntimeIdProperty', '{42, 1}'),
  P('RuntimeIdProperty', '42'),
  P('IsEnabledProperty', '$true'),
  P('IsEnabledProperty', 'true'),
  P('IsEnabledProperty', `'true'`),
  P('LabeledByProperty', `'x'`),
  P('ClickablePointProperty', '1'),
  P('CultureProperty', '42'),
];

const LOGIC = [
  '[PropertyCondition]::TrueCondition',
  '[PropertyCondition]::FalseCondition',
  '[Condition]::TrueCondition',
  '[System.Windows.Automation.Condition]::FalseCondition',
  'Condition.TrueCondition',
  'TrueCondition',
  'FalseCondition',
  '[Automation]::RawViewCondition',
  '[Automation]::ControlViewCondition',
  '[Automation]::ContentViewCondition',
  'Automation.RawViewCondition',
  '[System.Windows.Automation.Automation]::ControlViewCondition',
  'ContentViewCondition',
  `[AndCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `[AndCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}, ${NAME(`'C'`)})`,
  `[OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `[NotCondition]::new(${NAME(`'A'`)})`,
  `[System.Windows.Automation.AndCondition]::new(${NAME(`'A'`)}, [Condition]::TrueCondition)`,
  `new AndCondition(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `New-Object OrCondition(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `[And]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `[NotCondition]::new([Automation]::ControlViewCondition)`,
  `[AndCondition]::new([OrCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)}), [NotCondition]::new(${P('ControlTypeProperty', 'Button')}))`,
  `[OrCondition]::new([AndCondition]::new([NotCondition]::new(${NAME(`'A'`)}), ${NAME(`'B'`)}), [AndCondition]::new(${NAME(`'C'`)}, [OrCondition]::new(${NAME(`'D'`)}, ${NAME(`'E'`)})))`,
  `[AndCondition]::new(\n  ${NAME(`'A'`)},\n  ${NAME(`'B'`)}\n)`,
  `[AndCondition]::new(${NAME(`'A'`)})`,
  `[OrCondition]::new(${NAME(`'A'`)})`,
  `[NotCondition]::new(${NAME(`'A'`)}, ${NAME(`'B'`)})`,
  `[AndCondition]::new(${NAME(`'A'`)}, 'B')`,
  `[OrCondition]::new(42, ${NAME(`'A'`)})`,
  `[NotCondition]::new('A')`,
  `[NotCondition]::new([ControlType]::Button)`,
];

const ERRORS = [
  '',
  '   ',
  '42',
  `'just a string'`,
  '[ControlType]::Button',
  '@(1, 2)',
  'garbage',
  "[PropertyCondition]::new([AutomationElement]::UnknownProp, 'value')",
  '[PropertyCondition]::new([AutomationElement]::NameProperty)',
  `[PropertyCondition]::new([AutomationElement]::NameProperty, 'a', 'b')`,
  `${NAME(`'a'`)} trailing`,
  `${NAME(`'a'`)} ${NAME(`'b'`)}`,
  `[AndCondition]::new()`,
  `[FooCondition]::new(${NAME(`'a'`)})`,
  `[Name] -eq 'x'`,
];

export const SELECTOR_CORPUS: string[] = [
  ...new Set([
    ...PROPERTY_MATRIX,
    ...CONTROL_TYPES,
    ...ENUMS,
    ...PROPERTY_SPELLINGS,
    ...STRINGS,
    ...VALUE_FORMS,
    ...LOGIC,
    ...ERRORS,
  ]),
];

type Outcome = {dto: unknown} | {error: string; message?: string};

export interface IntendedChange {
  selector: string;
  /** what the PowerShell-object pipeline produced */
  before: Outcome;
  /** what the DTO parser produces */
  after: Outcome;
}

const prop = (property: string, value: unknown) => ({dto: {type: 'property', property, value}});
const unprocessed = (selector: string, rest: string) => ({
  error: 'InvalidSelectorError',
  message: `Could not parse Windows Automation selector expression '${selector}'. Some parts of the selector were left unprocessed: '${rest}'.`,
});

/**
 * Selectors whose result deliberately changed. Each one was broken before: the value either
 * never parsed or reached the server as PowerShell source text it cannot interpret.
 */
export const INTENDED_CHANGES: IntendedChange[] = [
  // ControlType 50039/50040: the old UIAutomationClient workaround produced 'semantic zoom' /
  // 'app bar', which WincoreServer's ControlTypeMap rejects; it knows SemanticZoom/AppBar natively.
  {
    selector: P('ControlTypeProperty', 'SemanticZoom'),
    before: prop('ControlType', 'semantic zoom'),
    after: prop('ControlType', 'SemanticZoom'),
  },
  {
    selector: P('ControlTypeProperty', '[ControlType]::AppBar'),
    before: prop('ControlType', 'app bar'),
    after: prop('ControlType', 'AppBar'),
  },
  // Point / Rect / CultureInfo values used to be sent as PowerShell constructor source.
  {
    selector: P('ClickablePointProperty', '[System.Windows.Point]::new(1, 2)'),
    before: prop('ClickablePoint', '[System.Windows.Point]::new(1, 2)'),
    after: prop('ClickablePoint', {x: 1, y: 2}),
  },
  {
    selector: P('ClickablePointProperty', '[Point]::new(1.5, -2)'),
    before: prop('ClickablePoint', '[System.Windows.Point]::new(1.5, -2)'),
    after: prop('ClickablePoint', {x: 1.5, y: -2}),
  },
  {
    selector: P('BoundingRectangleProperty', '[System.Windows.Rect]::new(1, 2, 3, 4)'),
    before: prop('BoundingRectangle', '[System.Windows.Rect]::new(1, 2, 3, 4)'),
    after: prop('BoundingRectangle', {x: 1, y: 2, width: 3, height: 4}),
  },
  // the Point/Size/Vector overloads computed NaN (they read `.groups` of unnamed captures)
  {
    selector: P('BoundingRectangleProperty', '[Rect]::new([Point]::new(1, 2), [Size]::new(3, 4))'),
    before: prop('BoundingRectangle', '[System.Windows.Rect]::new(NaN, NaN, NaN, NaN)'),
    after: prop('BoundingRectangle', {x: 1, y: 2, width: 3, height: 4}),
  },
  {
    selector: P('BoundingRectangleProperty', '[Rect]::new([Point]::new(5, 6), [Point]::new(1, 2))'),
    before: prop('BoundingRectangle', '[System.Windows.Rect]::new(NaN, NaN, NaN, NaN)'),
    after: prop('BoundingRectangle', {x: 1, y: 2, width: 4, height: 4}),
  },
  {
    selector: P('BoundingRectangleProperty', '[Rect]::new([Point]::new(5, 6), [Vector]::new(-2, 3))'),
    before: prop('BoundingRectangle', '[System.Windows.Rect]::new(NaN, NaN, NaN, NaN)'),
    after: prop('BoundingRectangle', {x: 3, y: 6, width: 2, height: 3}),
  },
  {
    selector: P('BoundingRectangleProperty', '[Rect]::new([Size]::new(3, 4))'),
    before: prop('BoundingRectangle', '[System.Windows.Rect]::new(0, 0, NaN, NaN)'),
    after: prop('BoundingRectangle', {x: 0, y: 0, width: 3, height: 4}),
  },
  {
    selector: P('CultureProperty', '[System.Globalization.CultureInfo]::new(1033)'),
    before: prop('Culture', '[System.Globalization.CultureInfo]::new(1033)'),
    after: prop('Culture', 1033),
  },
  // CultureInfo(name) never parsed: its string argument was replaced before the regex ran
  {
    selector: P('CultureProperty', `[CultureInfo]::new('en-US')`),
    before: unprocessed(
      P('CultureProperty', `[CultureInfo]::new('en-US')`),
      '[PropertyCondition]::new([AutomationElement]::CultureProperty, [CultureInfo]::new(<processed>))',
    ),
    after: prop('Culture', 'en-US'),
  },
  // Double-quoted strings were unquoted in place and then never recognised as values; inside
  // single-quoted strings their quotes were stripped.
  {
    selector: NAME(`"Calculator"`),
    before: unprocessed(
      NAME(`"Calculator"`),
      '[PropertyCondition]::new([AutomationElement]::NameProperty, Calculator)',
    ),
    after: prop('Name', 'Calculator'),
  },
  {
    selector: NAME(`""`),
    before: unprocessed(NAME(`""`), '[PropertyCondition]::new([AutomationElement]::NameProperty, )'),
    after: prop('Name', ''),
  },
  {
    selector: NAME('"a`"b"'),
    before: unprocessed(NAME('"a`"b"'), '[PropertyCondition]::new([AutomationElement]::NameProperty, ab)'),
    after: prop('Name', 'a"b'),
  },
  {
    selector: NAME(`"a""b"`),
    before: unprocessed(NAME(`"a""b"`), '[PropertyCondition]::new([AutomationElement]::NameProperty, ab)'),
    after: prop('Name', 'a"b'),
  },
  {
    selector: NAME('"tab`there`n$x `q"'),
    before: unprocessed(
      NAME('"tab`there`n$x `q"'),
      // (the unquoted "tab" is then taken for ControlType.Tab)
      '[PropertyCondition]::new([AutomationElement]::NameProperty, <processed>\there\n$x )',
    ),
    after: prop('Name', 'tab\there\n$x q'),
  },
  {
    selector: NAME(`"it's"`),
    before: unprocessed(NAME(`"it's"`), "[PropertyCondition]::new([AutomationElement]::NameProperty, it's)"),
    after: prop('Name', "it's"),
  },
  {
    selector: NAME(`'say "hi"'`),
    before: prop('Name', 'say hi'),
    after: prop('Name', 'say "hi"'),
  },
];
