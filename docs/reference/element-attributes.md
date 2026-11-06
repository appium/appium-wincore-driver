---
title: Element Attributes
---

`getAttribute` accepts every UIA property name above (`Name`,
`AutomationId`, `IsEnabled`, …), the standard accessibility names, and
these pattern-qualified aliases:

| Name | Same as |
| --- | --- |
| `Value.Value` | `Value` |
| `Value.IsReadOnly` | `ValuePattern.IsReadOnly` |
| `SelectionItem.IsSelected` | `SelectionItemPattern.IsSelected` |
| `LegacyIAccessible.Value` | `LegacyValue` |
| `LegacyIAccessible.Name` | `LegacyName` |
| `LegacyIAccessible.Description` | `LegacyDescription` |
| `LegacyIAccessible.Role` | `LegacyRole` |
| `LegacyIAccessible.State` | `LegacyState` |
| `LegacyIAccessible.DefaultAction` | `LegacyDefaultAction` |

Names are case-insensitive. Two more are `getAttribute`-only:

- `ExpandCollapseState`: `Expanded`, `Collapsed`, `PartiallyExpanded`
  or `LeafNode`. On MSAA elements without `ExpandCollapsePattern` it is
  read from the MSAA state bits; it errors when the element reports no
  state.
- `ProviderDescription`: which UIA provider serves the element (for
  example `MSAA Proxy`). Useful to tell why an element behaves the way
  it does.
