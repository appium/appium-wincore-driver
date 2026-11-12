---
title: Element Attributes
---

The WinCore driver exposes element properties from [UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-automation-element-propids)
(UIA) and from [Microsoft Active Accessibility](https://learn.microsoft.com/en-us/windows/win32/winauto/microsoft-active-accessibility)
(MSAA).

The attributes listed in the first part of this page are included in the page source for every
element, and can be used in [XPath](./locator-strategies.md#xpath) locators. In the page source,
all values are strings, booleans are `true` or `false`, and an attribute that does not apply to an
element is an empty string. The element's tag name is its programmatic control type name, such as
`Button` or `Edit`.

All of these attributes, and the [additional attributes](#additional-attributes) at the end of this
page, can also be retrieved with [the standard Get Element Attribute endpoint](https://www.w3.org/TR/webdriver2/#get-element-attribute).
Attribute names are case-insensitive there.

## `AcceleratorKey`

> Example: `Ctrl+S`

The shortcut key combination that invokes the element's action.

## `AccessKey`

> Example: `Alt+F`

The access key (mnemonic) that activates the element.

## `AutomationId`

> Example: `num5Button`

The identifier assigned to the element by its developer. Used by the
[`accessibility id`](./locator-strategies.md#accessibility-id) locator strategy.

## `ClassName`

> Example: `Button`

The class name of the element's underlying control. Used by the
[`class name`](./locator-strategies.md#class-name) locator strategy.

## `FrameworkId`

> Example: `WPF`

The UI framework that the element belongs to, such as `Win32`, `WinForm`, `WPF` or `XAML`.

## `HasKeyboardFocus`

> Example: `false`

Whether the element has keyboard focus.

## `HelpText`

> Example: `Saves the current document`

Help text associated with the element, usually its tooltip.

## `IsContentElement`

> Example: `true`

Whether the element is part of the content view of the UIA tree.

## `IsControlElement`

> Example: `true`

Whether the element is part of the control view of the UIA tree.

## `IsEnabled`

> Example: `true`

Whether the element is enabled.

## `IsKeyboardFocusable`

> Example: `true`

Whether the element can receive keyboard focus.

## `IsOffscreen`

> Example: `false`

Whether the element is outside of the visible screen area.

## `IsPassword`

> Example: `false`

Whether the element contains protected content, such as a password field. On such elements,
[`Value`](#value) and [`LegacyValue`](#legacyvalue) are always empty in the page source.

## `IsRequiredForForm`

> Example: `false`

Whether the element must be filled in on a form.

## `ItemStatus`

> Example: `Busy`

A free-form status string reported by the element.

## `ItemType`

> Example: `Document`

A free-form description of the type of item the element represents.

## `LocalizedControlType`

> Example: `button`

The control type name in the language of the operating system. Used by the
[`tag name`](./locator-strategies.md#tag-name) locator strategy when given in lowercase.

## `Name`

> Example: `Five`

The element's visible label. Used by the [`name`](./locator-strategies.md#name) locator strategy.

## `Orientation`

> Example: `0`

The orientation of the element as a number: `0` (none), `1` (horizontal) or `2` (vertical).

## `ProcessId`

> Example: `4242`

The ID of the process that owns the element.

## `RuntimeId`

> Example: `42.1311890.4.12`

The element's UIA runtime identifier, as dot-separated numbers. Used by the
[`id`](./locator-strategies.md#id) locator strategy.

## `x`, `y`, `width`, `height`

> Example: `x="120" y="210" width="80" height="60"`

The element's bounding rectangle in screen coordinates. Omitted when the element has no bounding
rectangle.

## `Value`

> Example: `Degraded`

The element's value, from `ValuePattern.Value`. See the
[Standard Accessibility Values guide](../guides/standard-accessibility-values.md).

## `LegacyValue`

> Example: `db-01;Running;Degraded`

The MSAA value (`accValue`), from `LegacyIAccessible.Value`. Often holds the real content of legacy
grid cells and rows. See the [Standard Accessibility Values guide](../guides/standard-accessibility-values.md).

## `LegacyName`

> Example: `Status row 2`

The MSAA name, from `LegacyIAccessible.Name`.

## `LegacyDescription`

> Example: `Server status`

The MSAA description, from `LegacyIAccessible.Description`.

## `LegacyRole`

> Example: `29`

The MSAA role number, from `LegacyIAccessible.Role`.

## `LegacyState`

> Example: `1048576`

The MSAA state bits, from `LegacyIAccessible.State`.

## Additional Attributes

The following attributes are not included in the page source, but can be retrieved with the Get
Element Attribute endpoint.

### `BoundingRectangle`

> Example: `{"x": 120, "y": 210, "width": 80, "height": 60}`

The element's bounding rectangle in screen coordinates, as an object.

### `ClickablePoint`

> Example: `{"x": 160, "y": 240}`

A point on the element that can be clicked, as an object. Returns an error if the element has no
clickable point.

### `ControlType`

> Example: `Button`

The programmatic control type name, which is also the element's tag name. Elements whose control
type has no standard name report `Custom`.

### `Culture`

> Example: `1033`

The locale identifier of the element.

### `ExpandCollapseState`

> Example: `Collapsed`

One of `Expanded`, `Collapsed`, `PartiallyExpanded` or `LeafNode`. For MSAA elements without the
UIA ExpandCollapse pattern, it is read from the MSAA state bits. Returns an error if the element
reports no expand/collapse state.

### `HeadingLevel`

> Example: `80051`

The UIA heading level identifier of the element.

### `IsDialog`

> Example: `false`

Whether the element is a dialog window.

### `Is<Pattern>PatternAvailable`

> Example: `true`

Whether the element supports a given UIA control pattern. Available for the `Dock`,
`ExpandCollapse`, `GridItem`, `Grid`, `Invoke`, `MultipleView`, `RangeValue`, `SelectionItem`,
`Selection`, `Scroll`, `ScrollItem`, `Table`, `TableItem`, `Text`, `Toggle`, `Transform`, `Value`,
`Window` and `LegacyIAccessible` patterns, for example `IsInvokePatternAvailable`.

### `LegacyDefaultAction`

> Example: `Press`

The MSAA default action, from `LegacyIAccessible.DefaultAction`.

### `NativeWindowHandle`

> Example: `1706316`

The handle of the element's native window, if it has one.

### `PositionInSet`, `SizeOfSet`

> Example: `2`, `5`

The element's position within its group, and the size of that group, for example for list items.

### `ProviderDescription`

A description of the UIA provider that serves the element. It names the provider, for example
`MSAA Proxy` for elements bridged from MSAA, which helps to understand why an element behaves the
way it does.

### Pattern-Qualified Aliases

The following names are accepted as aliases:

| Name | Same as |
| --- | --- |
| `Value.Value` | [`Value`](#value) |
| `Value.IsReadOnly` | Whether the element's value is read-only |
| `SelectionItem.IsSelected` | Whether the element is selected |
| `LegacyIAccessible.Value` | [`LegacyValue`](#legacyvalue) |
| `LegacyIAccessible.Name` | [`LegacyName`](#legacyname) |
| `LegacyIAccessible.Description` | [`LegacyDescription`](#legacydescription) |
| `LegacyIAccessible.Role` | [`LegacyRole`](#legacyrole) |
| `LegacyIAccessible.State` | [`LegacyState`](#legacystate) |
| `LegacyIAccessible.DefaultAction` | [`LegacyDefaultAction`](#legacydefaultaction) |
