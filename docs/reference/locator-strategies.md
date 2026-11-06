---
title: Locator Strategies
---

| Strategy | WebdriverIO selector | Maps to UIA property |
| --- | --- | --- |
| `accessibility id` | `~AutomationId` | `AutomationId` |
| `class name` | `.ClassName` | `ClassName` |
| `id` | decimal `RuntimeId` string | `RuntimeId` |
| `name` | element visible label | `Name` |
| `tag name` | control type name | `ControlType` (PascalCase) or `LocalizedControlType` (lowercase) |
| `css selector` | compound CSS rule | compiled to `-windows uiautomation` |
| `xpath` | XPath 1.0 expression | any UIA attribute |
| `-windows uiautomation` | raw UIA condition | C#/PowerShell condition |

```js
await driver.$('~SubmitButton')                              // accessibility id
await driver.$('//Button[@Name="OK"]')                       // xpath
await driver.$('.TextBlock')                                 // class name
await driver.$('//Button[1]')                                // nth button
```

## Locator performance

Element lookups take one of two paths in `WincoreServer`:

1. **Native UIA condition search (`FindFirst` / `FindAll` with `TreeScope.Descendants`)** — used by `id`, `accessibility id`, `class name`, `tag name`, `name`, `-windows uiautomation`, and `css selector`. The condition is evaluated inside UIA3's native traversal without building an XML tree or reading unrelated properties. Single-element `findElement` (`FindFirst`) short-circuits on the first match.
2. **Subtree XML materialization (`UiaXmlModel.Build` + `System.Xml.XPath`)** — used by `xpath`. Every node under the search root is walked (`FindAllBuildCache` with `TreeScope.Children`, reading ~25 UIA properties plus `Value`/`Legacy*` per node) to build an in-memory `XmlDocument` before the XPath expression runs. Even a single-element `findElement` pays the full subtree walk cost (~1.5 ms/node on native WPF providers, or ~4.5–6.0 s on a ~3,000-node window; see [Performance](../guides/performance.md)).

| Strategy | Absolute (`driver.$` / `driver.$$`) | Relative (`element.$` / `element.$$`) | Execution path and notes |
| --- | --- | --- | --- |
| `id` (`RuntimeId`) | **A+ (Fastest)** | **A+ (Fastest)** | Native `PropertyCondition(RuntimeId)`. Direct integer-tuple comparison; `FindFirst` stops at the first match. |
| `accessibility id` (`AutomationId`) | **A+ (Fastest)** | **A+ (Fastest)** | Native `PropertyCondition(AutomationId)`. Stored directly on the provider peer without locale formatting. |
| `-windows uiautomation` | **A (Fast)** | **A+ (Fastest)** | Native `PropertyCondition` / `AndCondition` / `OrCondition` / `NotCondition`. Narrowing with `ControlType` + `AutomationId`/`Name` lets UIA skip non-matching control types early. |
| `css selector` | **A (Fast)** | **A+ (Fastest)** | Compiles in Node (`< 1 ms`) to a `-windows uiautomation` condition and runs the same native `FindFirst` / `FindAll` path. |
| `class name` (`ClassName`) | **A (Fast)** | **A (Fast)** | Native `PropertyCondition(ClassName)`. Fast for `findElement`; `findElements` cost scales with the number of matched elements saved to the element table. |
| `tag name` (PascalCase, e.g. `Button`) | **A (Fast)** | **A (Fast)** | Native `PropertyCondition(ControlType)` using the integer control-type ID (`UIA_*ControlTypeId`). Locale-independent and faster than string comparisons. |
| `name` (`Name`) | **B (Good)** | **A (Fast)** | Native `PropertyCondition(Name)`. Avoids XML materialization, but computing accessible `Name` on complex or MSAA-bridged controls is slightly more expensive per visited node than `AutomationId`. |
| `tag name` (lowercase, e.g. `button`) | **B (Moderate)** | **A (Fast)** | Native `PropertyCondition(LocalizedControlType)`. Compares the OS-localized control type string on each visited node; prefer PascalCase (`Button`) for both speed and locale independence. |
| `xpath` | **D (Slow)** | **B–C (Moderate to Fast)** | Materializes the entire search-root subtree into an `XmlDocument` before evaluating XPath. Cost is `O(N_subtree)` (~1.5 ms/node on WPF, ~3–5 ms/node on WinForms/MSAA). |

### Absolute vs. relative lookup

- **Absolute lookup (`driver.findElement` / `driver.findElements`)** resolves the attached top-level window via `IUIAutomation.ElementFromHandle(hwnd)` (or the desktop root in `Root` sessions) and searches the entire window subtree. In `Root` sessions, an un-scoped lookup walks across all open desktop windows.
- **Relative lookup (`element.findElement` / `element.findElements`)** looks up the parent `IUIAutomationElement` from the session element table in `O(1)` and scopes `TreeScope.Descendants` (or `UiaXmlModel.Build` for XPath) strictly to that element's subtree.

When XPath features (`contains()`, `starts-with()`, positional predicates, upward axes, or `LegacyValue`) are required on a large window, anchor the container with a native condition locator first and run a relative XPath query inside it:

```js
// Slow (~4.5s on a 3,000-node window): walks the entire window to build the XML model
const rowSlow = await driver.$('//DataItem[starts-with(@LegacyValue, "db-01;")]');

// Fast (~50-100ms): native AutomationId lookup for the grid, then XPath only over the grid's subtree
const grid = await driver.$('~ServersGrid');
const rowFast = await grid.$('.//DataItem[starts-with(@LegacyValue, "db-01;")]');
```

## XPath node tests (tag names)

A node test like `//Button` matches on the element's **programmatic**
control-type name — `Button`, `Edit`, `CheckBox`, `DataGrid`, … — not the
localized name the `tag name` strategy uses. These names are:

- **PascalCase and case-sensitive.** `//Button` matches; `//button` and
  `//BUTTON` match nothing. XPath 1.0 has no case-insensitive node test.
- **Language-neutral.** `//Button` matches identically on an English,
  Hebrew, or any other localized Windows.

An element whose control type has no standard name is tagged `Custom`. When
unsure of the tag, match on an attribute instead: `//*[@Name="OK"]`.

## XPath substring matching

Use XPath `contains()` or `starts-with()` to match elements by partial name:

```js
await driver.$('//*[contains(@Name, "Execute")]')
await driver.$('//Button[starts-with(@Name, "OK")]')
```

`PropertyConditionFlags.MatchSubstring` is not supported in the `-windows uiautomation` strategy. Use XPath instead.

## Standard accessibility values

Many controls publish their real content through standard accessibility
but not in UIA `Name`: DevExpress grids and trees, the .NET Framework
`DataGridView`, and other MSAA-based controls (VB6, Delphi, older MFC,
third-party grids). A grid cell's `Name` is a placeholder such as
`Status row 2`, while the content (`Degraded`) is in the MSAA value.
Every element in page source and XPath carries these attributes, with no
plugin or capability needed:

| Attribute | Source |
| --- | --- |
| `Value` | `ValuePattern.Value` |
| `LegacyValue` | `LegacyIAccessible.Value` (MSAA `accValue`) |
| `LegacyName` | `LegacyIAccessible.Name` |
| `LegacyDescription` | `LegacyIAccessible.Description` |
| `LegacyRole` | `LegacyIAccessible.Role` (MSAA role number) |
| `LegacyState` | `LegacyIAccessible.State` (MSAA state bits) |

```js
await driver.$('//DataItem[@LegacyValue="Degraded"]')
await driver.$('//*[starts-with(@LegacyValue, "db-01;")]')   // a whole grid row
```

`Value` and `LegacyValue` are usually equal on MSAA controls. Some
elements, such as grid rows, only have `LegacyValue`. An attribute is
empty when the element doesn't support it.

In page source and XPath, the `Legacy*` attributes are empty on WPF and
UWP (XAML) elements. Those frameworks have their own UIA provider, so
there is no MSAA object behind them: UIA would build the legacy values
from `Name`/`Value` at a high cost for every element. `getAttribute`
still returns them for any single element.

In page source and XPath, `Value` and `LegacyValue` are always empty on
password elements (`IsPassword`), even when the control itself would
return its secret. If `IsPassword` can't be read, they are treated as a
password. They are also cut to 4096 characters there, without splitting
an emoji or other surrogate pair.

`getAttribute` is an explicit read of one element and is not filtered:
`getAttribute('Value')` / `getAttribute('LegacyValue')` return the full
value, and **on a password element that can be the secret itself** (as
`windows: getValue` already does). Don't log those results.

Page source text keeps every character XML allows, including emoji.
Only characters XML 1.0 cannot carry (control characters, unpaired
surrogates) are removed.

## -windows uiautomation

Accepts a C#/PowerShell-style UIA condition expression. Supports exact property matches and logical combinators:

```js
// exact match
await driver.findElement('-windows uiautomation', "new PropertyCondition(AutomationElement.NameProperty, 'OK')")

// logical AND
await driver.findElement('-windows uiautomation', "new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button), new PropertyCondition(AutomationElement.NameProperty, 'OK'))")
```

**Limitation:** `PropertyConditionFlags` (e.g. `MatchSubstring`, `IgnoreCase`) are not parsed. Use XPath `contains()` for substring matching.
