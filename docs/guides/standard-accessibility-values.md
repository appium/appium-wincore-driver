---
title: Standard Accessibility Values
---

Many controls publish their real content through standard accessibility, but not in the UI
Automation `Name` property. This is common for DevExpress grids and trees, the .NET Framework
`DataGridView`, and other MSAA-based controls (VB6, Delphi, older MFC, third-party grids). For
example, a grid cell's `Name` can be a placeholder such as `Status row 2`, while its content
(`Degraded`) is in the MSAA value.

To reach such content, every element in the page source and in [XPath](../reference/locator-strategies.md#xpath)
carries the following attributes, with no plugin or capability needed:

| Attribute | Source |
| --- | --- |
| [`Value`](../reference/element-attributes.md#value) | `ValuePattern.Value` |
| [`LegacyValue`](../reference/element-attributes.md#legacyvalue) | `LegacyIAccessible.Value` (MSAA `accValue`) |
| [`LegacyName`](../reference/element-attributes.md#legacyname) | `LegacyIAccessible.Name` |
| [`LegacyDescription`](../reference/element-attributes.md#legacydescription) | `LegacyIAccessible.Description` |
| [`LegacyRole`](../reference/element-attributes.md#legacyrole) | `LegacyIAccessible.Role` (MSAA role number) |
| [`LegacyState`](../reference/element-attributes.md#legacystate) | `LegacyIAccessible.State` (MSAA state bits) |

## Finding Elements by Value

```js
await driver.$('//DataItem[@LegacyValue="Degraded"]')
await driver.$('//*[starts-with(@LegacyValue, "db-01;")]')   // a whole grid row
```

`Value` and `LegacyValue` are usually equal on MSAA controls. Some elements, such as grid rows,
only have `LegacyValue`. An attribute is empty when the element doesn't support it.

On large windows, find the grid first and search inside it, as described in
[Absolute vs. Relative Lookup](../reference/locator-strategies.md#absolute-vs-relative-lookup).

## WPF and UWP Elements

In the page source and XPath, the `Legacy*` attributes are empty on WPF and UWP (XAML) elements.
Those frameworks have their own UIA provider, so there is no MSAA object behind them: UIA would
build the legacy values from `Name` and `Value` at a high cost for every element. The Get Element
Attribute endpoint still returns them for any single element.

## Passwords and Long Values

In the page source and XPath, `Value` and `LegacyValue` are always empty on password elements
([`IsPassword`](../reference/element-attributes.md#ispassword)), even when the control itself would
return its secret. If `IsPassword` can't be read, the element is treated as a password. Values are
also cut to 4096 characters there, without splitting an emoji or other surrogate pair.

!!! warning

    The Get Element Attribute endpoint reads a single element and is not filtered.
    `getAttribute('Value')` and `getAttribute('LegacyValue')` return the full value, and **on a
    password element that can be the secret itself** (as `windows: getValue` already does). Don't
    log those results.

Page source text keeps every character that XML allows, including emoji. Only characters that XML
1.0 cannot carry (control characters, unpaired surrogates) are removed.
