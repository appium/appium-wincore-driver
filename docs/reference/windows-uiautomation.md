---
title: UIAutomation Locator Strategy
---

The WinCore driver supports searching elements using the _UIAutomation_
[locator search strategy](./locator-strategies.md#windows-uiautomation) (`-windows uiautomation`).
Its selector is a [UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-wclient)
_condition_, written the way it would be constructed with the
[`System.Windows.Automation`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation)
classes in C# or PowerShell. The driver never executes the expression: it parses it into a native
UIA condition, and the search runs inside UIA's own tree traversal. This makes the strategy as fast
as `accessibility id` or `class name`, and unlike them it can combine any number of properties.
A condition is built from the following parts:

- a [property condition](#property-conditions), which compares one element property to a value
- the [logical conditions](#logical-conditions) `AndCondition`, `OrCondition` and `NotCondition`,
  which combine other conditions
- the constant and [view conditions](#constant-and-view-conditions), such as `TrueCondition`

## Quick Examples

=== "UIAutomation"

    ```js
    // javascript
    await driver.findElement('-windows uiautomation',
      "new AndCondition(" +
        "new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::Button), " +
        "new PropertyCondition(AutomationElement.NameProperty, 'OK'))");
    ```

=== "PowerShell Style"

    ```js
    // javascript
    await driver.findElement('-windows uiautomation',
      "[AndCondition]::new(" +
        "[PropertyCondition]::new([AutomationElement]::ControlTypeProperty, [ControlType]::Button), " +
        "[PropertyCondition]::new([AutomationElement]::NameProperty, 'OK'))");
    ```

=== "XPath"

    ```js
    // javascript
    await driver.findElement('xpath', "//Button[@Name='OK']");
    ```

All three examples find the button named `OK`. The first two are the same condition written in C#
and in PowerShell style.

## Property Conditions

A property condition has the form `PropertyCondition(property, value)`. It matches elements whose
property is equal to the value. The property is one of the `AutomationElement` properties listed in
[Properties](#properties), and the value must be of the type the property expects: for example
`NameProperty` expects a string, and `IsEnabledProperty` a boolean.

|UIAutomation|Selects|XPath alternative|
|---|---|---|
|`new PropertyCondition(AutomationElement.AutomationIdProperty, 'SubmitButton')`|elements with the `AutomationId` `SubmitButton`|`//*[@AutomationId='SubmitButton']`|
|`new PropertyCondition(AutomationElement.ClassNameProperty, 'TextBlock')`|elements of the class `TextBlock`|`//*[@ClassName='TextBlock']`|
|`new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::Edit)`|text boxes|`//Edit`|
|`new PropertyCondition(AutomationElement.IsEnabledProperty, $true)`|enabled elements|`//*[@IsEnabled='true']`|
|`new PropertyCondition(AutomationElement.ProcessIdProperty, 4242)`|elements of the process with the ID `4242`|`//*[@ProcessId='4242']`|

String properties are compared exactly. The `PropertyConditionFlags` argument of the native class,
such as `MatchSubstring` and `IgnoreCase`, is not supported. Use [XPath](./locator-strategies.md#xpath)
`contains()` for substring matching.

### Accepted Spellings

The driver accepts the common ways of writing a condition in C# and in PowerShell. All names are
case-insensitive, and the following parts are optional:

- the `System.Windows.Automation.` and `Automation.` namespace prefixes
- the `AutomationElement.` or `[AutomationElement]::` prefix of a property name
- the `Property` suffix of a property name, so `Name` is the same as `NameProperty`
- the `Condition` suffix of the logical conditions, so `[And]::new(...)` is the same as
  `[AndCondition]::new(...)`
- the `Condition` suffix of `PropertyCondition`, down to `Property(...)`
- the `Property` prefix of `TrueCondition` and `FalseCondition`, which also accept `PropertyCondition.`

The following spellings are all the same condition:

```text
new PropertyCondition(AutomationElement.NameProperty, 'OK')
PropertyCondition(NameProperty, 'OK')
[PropertyCondition]::new([AutomationElement]::NameProperty, 'OK')
[System.Windows.Automation.PropertyCondition]::new([AutomationElement]::Name, 'OK')
[PROPERTYCONDITION]::NEW([AUTOMATIONELEMENT]::NAMEPROPERTY, 'OK')
```

Whitespace around the condition and between its parts is ignored, so long conditions can be split
into several lines.

### Values

|Type|Syntax|Example|
|---|---|---|
|string|single-quoted: verbatim, `''` stands for a quote|`'it''s'`|
|string|double-quoted: `""` or `` `" `` stands for a quote, and the PowerShell escapes like `` `n `` and `` `t `` work; `$` is literal, so there is no variable expansion|`"line1`nline2"`|
|boolean|`$true`, `$false`, `true` or `false`, in any case|`$true`|
|integer|a decimal number|`4242`|
|integer array|`@(1, 2)`, `[int[]] @(1, 2)`, `new int[] {1, 2}` or `{1, 2}`|`@(42, 1, 2)`|
|[control type](#control-types)|`[ControlType]::Name`, `ControlType.Name` or the bare `Name`|`[ControlType]::Button`|
|orientation|`[OrientationType]::Name`, `OrientationType.Name` or the bare `Name`: `None`, `Horizontal`, `Vertical`|`[OrientationType]::Vertical`|
|heading level|`[AutomationHeadingLevel]::Name`, `AutomationHeadingLevel.Name` or the bare `Name`: `None`, `Level1` to `Level9`|`[AutomationHeadingLevel]::Level2`|
|culture|`[CultureInfo]::new('en-US')` or `[CultureInfo]::new(1033)`, with an optional second boolean argument that is ignored|`[CultureInfo]::new('en-US')`|
|point|`[System.Windows.Point]::new(x, y)`|`[System.Windows.Point]::new(10, 20)`|

Orientation and heading level also accept their numeric values: `0`-`2` and `0`-`9`.

## Logical Conditions

|Condition|Matches|Arguments|
|---|---|---|
|`AndCondition(c1, c2, ...)`|elements matching all of the conditions|2 or more|
|`OrCondition(c1, c2, ...)`|elements matching at least one of the conditions|2 or more|
|`NotCondition(c)`|elements not matching the condition|exactly 1|

The arguments are any other conditions, including logical ones, so conditions can be nested to
any depth. Every argument has to be a condition, not a value.

|UIAutomation|Selects|XPath alternative|
|---|---|---|
|``new OrCondition(new PropertyCondition(AutomationElement.NameProperty, 'OK'), new PropertyCondition(AutomationElement.NameProperty, 'Cancel'))``|elements named `OK` or `Cancel`|`//*[@Name='OK' or @Name='Cancel']`|
|``new NotCondition(new PropertyCondition(AutomationElement.IsOffscreenProperty, $true))``|elements visible on the screen|`//*[@IsOffscreen='false']`|
|``new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::Button), new NotCondition(new PropertyCondition(AutomationElement.IsEnabledProperty, $false)))``|enabled buttons|`//Button[@IsEnabled='true']`|

## Constant and View Conditions

|Condition|Matches|
|---|---|
|`[Condition]::TrueCondition`, `Condition.TrueCondition` or `TrueCondition`|every element|
|`[Condition]::FalseCondition`, `Condition.FalseCondition` or `FalseCondition`|no elements|
|`[Automation]::RawViewCondition`|every element, the same as `TrueCondition`|
|`[Automation]::ControlViewCondition`|elements of the UIA control view, which are those with `IsControlElement` equal to `true`|
|`[Automation]::ContentViewCondition`|elements of the UIA content view, which are those with both `IsControlElement` and `IsContentElement` equal to `true`|

The view conditions are useful as the building blocks of larger conditions, for example to skip
purely decorative elements:

```js
// javascript
await driver.findElement('-windows uiautomation',
  "new AndCondition([Automation]::ControlViewCondition, " +
    "new PropertyCondition(AutomationElement.NameProperty, 'Total'))");
```

## Properties

The property names are the `AutomationElement` properties, and most of them are available
as [element attributes](./element-attributes.md) of the same name.

### String Properties

`AutomationId`, `ClassName`, `Name`, `HelpText`, `FrameworkId`, `ItemStatus`, `ItemType`,
`LocalizedControlType`, `AcceleratorKey`, `AccessKey`, `Value`, `LegacyValue`, `LegacyName`,
`LegacyDescription`, `LegacyDefaultAction` and `ProviderDescription`.

### Boolean Properties

`HasKeyboardFocus`, `IsOffscreen`, `IsDialog`, `IsControlElement`, `IsContentElement`,
`IsPassword`, `IsKeyboardFocusable`, `IsEnabled`, `IsRequiredForForm`, and the
`Is<Pattern>PatternAvailable` properties, where `<Pattern>` is one of `Dock`, `ExpandCollapse`,
`Grid`, `GridItem`, `Invoke`, `ItemContainer`, `MultipleView`, `RangeValue`, `Scroll`,
`ScrollItem`, `Selection`, `SelectionItem`, `SynchronizedInput`, `Table`, `TableItem`, `Text`,
`Toggle`, `Transform`, `Value`, `VirtualizedItem` and `Window`.

### Integer Properties

`ProcessId`, `NativeWindowHandle`, `PositionInSet`, `SizeOfSet`, `LegacyRole` and `LegacyState`.

`RuntimeId` takes an integer array.

### Enum and Structured Properties

|Property|Value|
|---|---|
|`ControlType`|a [control type](#control-types)|
|`Orientation`|`None`, `Horizontal` or `Vertical`|
|`HeadingLevel`|`None` or `Level1` to `Level9`|
|`Culture`|a `CultureInfo`, by name or by LCID|
|`ClickablePoint`|a `System.Windows.Point`|

### Unsupported Properties

- `BoundingRectangle` is rejected with an error, because UIA can fail to match it on scaled
  displays. Find the element by another property, and read its `BoundingRectangle`
  [attribute](./element-attributes.md#boundingrectangle) instead.
- `LabeledBy` expects an element, which cannot be written in a selector.

### Control Types

The control type names are those of the
[`ControlType`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.controltype)
class, and are the same as the tag names of the [XPath](./locator-strategies.md#xpath) page source:

`Button`, `Calendar`, `CheckBox`, `ComboBox`, `Custom`, `DataGrid`, `DataItem`, `Document`, `Edit`,
`Group`, `Header`, `HeaderItem`, `Hyperlink`, `Image`, `List`, `ListItem`, `Menu`, `MenuBar`,
`MenuItem`, `Pane`, `ProgressBar`, `RadioButton`, `ScrollBar`, `Separator`, `Slider`, `Spinner`,
`SplitButton`, `StatusBar`, `Tab`, `TabItem`, `Table`, `Text`, `Thumb`, `TitleBar`, `ToolBar`,
`ToolTip`, `Tree`, `TreeItem` and `Window`.

`SemanticZoom` and `AppBar`, which exist in the UIA specification but not in the .NET class, are
accepted as well.

## More Examples

### Combining Properties

The enabled, visible edit field named `Email`:

=== "UIAutomation"

    ```js
    // javascript
    await driver.findElement('-windows uiautomation',
      "new AndCondition(" +
        "new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::Edit), " +
        "new PropertyCondition(AutomationElement.NameProperty, 'Email'), " +
        "new PropertyCondition(AutomationElement.IsEnabledProperty, $true), " +
        "new PropertyCondition(AutomationElement.IsOffscreenProperty, $false))");
    ```

=== "XPath"

    ```js
    // javascript
    await driver.findElement('xpath',
      "//Edit[@Name='Email' and @IsEnabled='true' and @IsOffscreen='false']");
    ```

=== "CSS Selector"

    ```js
    // javascript
    await driver.findElement('css selector', "Edit[name='Email']");
    ```

    The CSS selector does not support boolean attributes, so it does not check `IsEnabled` and
    `IsOffscreen`.

### Alternatives

Any button or menu item named `Save`, whichever the application uses:

```js
// javascript
await driver.findElement('-windows uiautomation',
  "new AndCondition(" +
    "new PropertyCondition(AutomationElement.NameProperty, 'Save'), " +
    "new OrCondition(" +
      "new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::Button), " +
      "new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::MenuItem)))");
```

The XPath equivalent is `//*[@Name='Save'][self::Button or self::MenuItem]`.

### Pattern Availability

All elements that can be toggled, such as check boxes and toggle buttons:

```js
// javascript
await driver.findElements('-windows uiautomation',
  "new PropertyCondition(AutomationElement.IsTogglePatternAvailableProperty, $true)");
```

### Elements of a Process

All elements of the application with the process ID `4242`, which is useful when searching from
the desktop `Root` session:

```js
// javascript
await driver.findElements('-windows uiautomation',
  "new PropertyCondition(AutomationElement.ProcessIdProperty, 4242)");
```

### Runtime ID

Finding an element again by the `RuntimeId`, which is read from the page source. The
[`id`](./locator-strategies.md#id) strategy does the same with the dot-separated form:

```js
// javascript
await driver.findElement('-windows uiautomation',
  "new PropertyCondition(AutomationElement.RuntimeIdProperty, @(42, 1311890, 4, 12))");
```

### Headings and Orientation

All level 2 headings, and all vertical scroll bars:

```js
// javascript
await driver.findElements('-windows uiautomation',
  "new PropertyCondition(AutomationElement.HeadingLevelProperty, [AutomationHeadingLevel]::Level2)");

await driver.findElements('-windows uiautomation',
  "new AndCondition(" +
    "new PropertyCondition(AutomationElement.ControlTypeProperty, [ControlType]::ScrollBar), " +
    "new PropertyCondition(AutomationElement.OrientationProperty, [OrientationType]::Vertical))");
```

## Errors

|Error|Cause|
|---|---|
|`invalid selector`|the expression is not valid syntax, has an unrecognized part, or does not evaluate to a condition (for example, a bare value); the message names the unprocessed part|
|`invalid selector`|the expression contains `BoundingRectangle`|
|`invalid selector`|`AndCondition` or `OrCondition` has fewer than 2 arguments, or `NotCondition` does not have exactly 1|
|`invalid argument`|the property name is unknown, or the value has the wrong type for the property|
|`invalid argument`|an argument of a logical condition is not a condition|

A selector may contain at most 512 values and conditions in total.

## More Information

- [Locator Strategies](./locator-strategies.md) — overview of all strategies and their performance
- [Element Attributes](./element-attributes.md) — the properties and their values as the driver reports them
- [UI Automation Properties Overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-properties-overview) — the meaning of each property
