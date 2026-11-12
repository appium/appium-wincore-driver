---
title: Locator Strategies
---

The WinCore driver supports several location strategies. The list below describes each strategy
along with usage recommendations.

Each strategy lists two speed grades, from **A+** (fastest) to **D** (slowest):

* **Absolute**: a lookup from the driver (`driver.findElement` / `driver.findElements`), which
  searches the whole subtree of the session window. In `Root` sessions, this walks across all open
  desktop windows.
* **Relative**: a lookup from an element (`element.findElement` / `element.findElements`), which
  only searches that element's subtree.

All strategies except [XPath](#xpath) run as a native UI Automation (UIA) condition search, which
is evaluated inside UIA's own tree traversal and stops at the first match for a single-element
lookup. See [Absolute vs. Relative Lookup](#absolute-vs-relative-lookup) for how to keep slower
lookups fast.

## Id

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`id`|A+|A+|`42.1311890.4.12`|

This strategy matches the element's [`RuntimeId`](./element-attributes.md#runtimeid), as
dot-separated numbers. Runtime IDs are assigned by UIA and change between application runs.

!!! info "When to Use"

    Use this strategy to find an element again after reading its `RuntimeId`, for example from the
    page source.

## Accessibility Id

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`accessibility id`|A+|A+|`SubmitButton`|

This strategy matches the element's [`AutomationId`](./element-attributes.md#automationid)
exactly. The value is stored directly on the element, without any locale formatting.

!!! info "When to Use"

    Use this strategy whenever the element has an `AutomationId`. It is the fastest and most stable
    strategy.

## Name

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`name`|B|A|`OK`|

This strategy matches the element's visible label, [`Name`](./element-attributes.md#name), exactly.
Computing the name of complex or MSAA-bridged controls is slightly more expensive than reading an
`AutomationId`.

!!! info "When to Use"

    Use this strategy for elements without an `AutomationId`, if their label is stable. Labels are
    usually localized, so they change with the language of the application.

## Class Name

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`class name`|A|A|`TextBlock`|

This strategy matches the element's [`ClassName`](./element-attributes.md#classname) exactly. Finding
many elements costs more as the number of matches grows.

!!! info "When to Use"

    Use this strategy for elements that can be identified by the class of their underlying control.

## Tag Name

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`tag name` (PascalCase)|A|A|`Button`|
|`tag name` (lowercase)|B|A|`button`|

This strategy matches the element's control type:

* A PascalCase name, such as `Button` or `CheckBox`, matches the programmatic
  [`ControlType`](./element-attributes.md#controltype). It is compared as a number, so it is fast and
  works the same on any Windows display language.
* A lowercase name, such as `button`, matches the [`LocalizedControlType`](./element-attributes.md#localizedcontroltype),
  which is compared as text and depends on the Windows display language.

!!! info "When to Use"

    Use the PascalCase form to find elements by their type. Prefer it over the lowercase form.

## CSS Selector

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`css selector`|A|A+|`Button[name="OK"]`|

This strategy converts a CSS selector to a [Windows UIAutomation](#windows-uiautomation) condition.
The conversion takes less than a millisecond, and the condition then runs the same native search.

The tag matches the programmatic control type (`Button`), `#value` matches the `AutomationId` and
`.value` matches the `ClassName`. Supported attributes are `name`, `automation-id` (aliases `id`
and `accessibility-id`), `class-name` (alias `class`), `control-type`, `localized-control-type`,
`help-text`, `framework-id`, `item-status` and `item-type`. Boolean attributes such as `enabled`
are not supported.

!!! info "When to Use"

    Use this strategy to combine several conditions in a compact form.

## Windows UIAutomation

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`-windows uiautomation`|A|A+|`new PropertyCondition(AutomationElement.NameProperty, 'OK')`|

This strategy accepts a UIA condition, written as in C# or PowerShell with
[`System.Windows.Automation`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation).
`PropertyCondition`, `AndCondition`, `OrCondition` and `NotCondition` are supported. The
expression is parsed, not executed.

```js
// exact match
await driver.findElement('-windows uiautomation', "new PropertyCondition(AutomationElement.NameProperty, 'OK')")

// logical AND
await driver.findElement('-windows uiautomation', "new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button), new PropertyCondition(AutomationElement.NameProperty, 'OK'))")
```

Narrowing a condition by `ControlType` together with `AutomationId` or `Name` lets UIA skip
elements of other types early.

!!! warning

    `PropertyConditionFlags` such as `MatchSubstring` and `IgnoreCase` are not supported. Use
    [XPath](#xpath) `contains()` for substring matching.

!!! info "When to Use"

    Use this strategy for conditions that combine several properties, when no single property
    identifies the element.

## XPath

|Name|Absolute|Relative|Example|
|---|---|---|---|
|`xpath`|D|B–C|`//Button[@Name="OK"]`|

This strategy relies on the XML tree generated by the driver's page source API. XPath version 2.0
is supported (through [XPath2.Net](https://github.com/StefH/XPath2.Net)), over all
[element attributes](./element-attributes.md) of the page source. The expression must return
elements: an expression returning any other value, such as `count(//Button)`, is an invalid
selector. Matching elements are always returned in document order.

Before the expression runs, every element in the searched subtree is read into an XML document,
even for a single-element lookup. The cost grows with the size of the subtree: about 1.5 ms per
element on WPF, and 3 to 5 ms per element on WinForms and MSAA controls. A lookup in a window of
3,000 elements can take 4.5 to 6 seconds.

Tag names in XPath are the programmatic control type names, such as `Button`, `Edit` or `DataGrid`.
They are case-sensitive (`//Button` matches, `//button` does not) and the same on any Windows
display language. Elements whose control type has no standard name are tagged `Custom`. When unsure
of the tag, match on an attribute instead: `//*[@Name="OK"]`.

Use string functions to match elements by part of an attribute, by a regular expression, or
regardless of case:

```js
await driver.$('//*[contains(@Name, "Execute")]')
await driver.$('//Button[starts-with(@Name, "OK")]')
await driver.$('//Button[ends-with(@AutomationId, "Button")]')
await driver.$('//Button[matches(@Name, "^Save( As)?$")]')
await driver.$('//Button[lower-case(@Name) = "ok"]')
await driver.$('//Button[@Name = ("Yes", "OK")]')
```

!!! warning "Stricter types than XPath 1.0"

    All attribute values in the page source are strings, and XPath 2.0 does not silently convert
    them like XPath 1.0 did. Some expressions that worked with XPath 1.0 are now invalid selectors:

    * Comparing an attribute to a number fails as soon as one element has a non-numeric value, for
      example `//Button[@Name = 7]` when another button is named `Plus`. Quote the value instead:
      `//Button[@Name = "7"]`.
    * Numeric comparisons on attributes that are often empty fail for the same reason, for example
      `//*[@Value > 5]`. Convert the value explicitly: `//*[number(@Value) > 5]`.
    * String functions accept a single value, so `//Window[contains(.//Text/@Name, "Total")]` fails
      when the window has several `Text` elements. Move the condition onto the element instead:
      `//Window[.//Text[contains(@Name, "Total")]]`.

    Comparing a boolean attribute to `true()` now compares its value:
    `//Button[@IsEnabled = true()]` only matches enabled buttons, while XPath 1.0 matched every
    button that had the attribute. Comparing to a string (`@IsEnabled = "true"`) works the same in
    both versions.

!!! info "When to Use"

    Use this strategy when no other strategy is applicable: for substring matching, positional
    predicates, matching on [standard accessibility values](../guides/standard-accessibility-values.md),
    or elements that can only be identified from their parent, sibling or descendant elements.
    On large windows, use it as a [relative lookup](#absolute-vs-relative-lookup).

## Absolute vs. Relative Lookup

An absolute lookup searches the whole session window. A relative lookup starts from an element that
was already found, and searches only that element's subtree.

When XPath is needed on a large window, find the container with a fast strategy first, then run a
relative XPath lookup inside it:

```js
// Slow (~4.5 s on a 3,000-element window): reads the whole window into XML
const rowSlow = await driver.$('//DataItem[starts-with(@LegacyValue, "db-01;")]');

// Fast (~50-100 ms): finds the grid by AutomationId, then reads only the grid into XML
const grid = await driver.$('~ServersGrid');
const rowFast = await grid.$('.//DataItem[starts-with(@LegacyValue, "db-01;")]');
```
