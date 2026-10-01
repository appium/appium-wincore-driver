# Spec: Standard accessibility values in the core driver

- **Status:** Implemented on `feat/standard-accessibility-values`
- **Date:** 2026-10-01
- **Scope:** `appium-wincore-driver` only (no plugins, no bridges)

## Summary

Many Windows controls publish their real content through standard
accessibility, but not in UIA `Name`. The content sits in the MSAA value
(`accValue`), which UIA exposes as `LegacyIAccessible.Value`, or in UIA
`ValuePattern.Value`. The driver can read these only in narrow places
today (see [Current state](#current-state)). They are missing from page
source, XPath, `findElement` conditions and `getAttribute`.

This spec makes those values first-class in the core driver, always on,
and fixes three pattern actions that report success without doing
anything. It also fixes three broken COM interop declarations that the
rest of the work depends on.

## Problem

### What users see today

On a stock DevExpress XtraGrid, every visible cell is a UIA `DataItem`
with a correct bounding rectangle, but its `Name` is a placeholder:

| UIA `Name` | MSAA `accValue` (real content) |
| --- | --- |
| `Status row 2` | `Degraded` |
| `Host row 5` | `web-01` |
| `Group Row` | `Environment: Production` |
| `Name row 1` (TreeList) | `EU West` |

With the driver as it is:

- Page source and XPath only carry `Name`, so the real content is
  invisible to Appium Inspector and to locators.
- `getAttribute('LegacyIAccessible.Value')` and
  `getAttribute('Value.Value')` fail with
  `InvalidArgument: Unknown automation property`.
- `getText` returns the placeholder (`Status row 2`).
- A test cannot assert "server `db-01` is `Degraded`" or locate a row by
  its content.

### Current state

What the driver can already read, so the gap is stated precisely:

- `windows: getValue` returns `ValuePattern.Value` for one element
  (`ElementCommands.GetValue`, documented in `API.md`).
- The MSAA walker (`lib/commands/native.ts`, server side
  `Commands/AccessibilityCommands.cs`) reads `accValue` and maps roles
  to names. It is a separate fallback tree, not the UIA tree that page
  source, XPath and find use.

Neither path feeds page source, XPath, find conditions or
`getAttribute`.

### Silent-success actions

Measured against the same DevExpress app with the plain driver:

| Call | Target | Result |
| --- | --- | --- |
| `windows: select` | grid data row | returns ok, no effect |
| `windows: collapse` | expanded group row | returns ok, no effect |
| `windows: expand` | expanded group row | returns ok, collapses it |
| `windows: expand` | TreeList cell | returns ok, no effect |

`click` on the same row works, so the elements are actionable. The
pattern paths are what misbehave.

The same failures reproduce without DevExpress on the licence-free
`msaa-legacy-controls` fixture (see [Test plan](#test-plan)). Measured
2026-10-01 by sending the RPCs straight to `WincoreServer.exe` (server
layer only, no client fallback), with the status label as ground truth:

| RPC | Target | Server result | Real effect |
| --- | --- | --- | --- |
| `selectElement` | non-selectable group | ok | none |
| `selectElement` | grid cell | `PatternNotSupported` | none |
| `expandElement` | expanded group | ok | collapsed it |
| `collapseElement` | collapsed group | `PatternNotSupported` | none |
| `expandElement` | stuck group | ok | none |
| `invokeElement` | group (action Expand) | ok | none |

The grid cell can be selected through MSAA
(`LegacyIAccessible.Select`), so the `PatternNotSupported` there is a
missed capability, not a correct refusal.

How the code produces these results:

- `expand` with no `ExpandCollapsePattern` falls back to
  `LegacyIAccessible.DoDefaultAction()`, which toggles. The server then
  checks the wrong state bit (`0x1000`) and only logs.
- `collapse` has no fallback, so it throws `PatternNotSupported`.
- `invoke` never uses `InvokePattern`, because the interface GUID in
  `UIA.cs` is wrong (see [Step 0](#step-0-fix-the-com-interop-declarations)).
  It falls through to `SelectionItemPattern.Select()`, which does
  nothing on a group.
- The client (`patternExpand` / `patternCollapse` in
  `lib/commands/extension.ts`) then reads `ExpandCollapseState`. On an
  element with no `ExpandCollapsePattern` that read does **not** fail:
  UIA returns the property's default value, so the server reports
  `"LeafNode"`. The client sees "not expanded" and sends ALT+Down to
  the element, then returns success.
- If the server call throws, the client also falls back to ALT+Down and
  returns success.

## Evidence

Measured 2026-09-30 / 2026-10-01 with a single-window WinForms app built
against each DevExpress version, stock configuration, no accessibility
changes. Values were read with an independent MSAA walker (not the
driver).

| Value | 19.1 | 20.2 | 22.2 | 24.2 | 25.2 | 26.1 |
| --- | --- | --- | --- | --- | --- | --- |
| Grid cell, bound | MSAA | MSAA | MSAA | MSAA | MSAA | MSAA |
| Grid cell, drawn | MSAA | MSAA | MSAA | MSAA | MSAA | MSAA |
| Group row | MSAA | MSAA | MSAA | MSAA | MSAA | MSAA |
| TreeList node | MSAA | MSAA | MSAA | MSAA | MSAA | MSAA |
| ComboBoxEdit item | Name | Name | Name | Name | Name | Name |
| TokenEdit token | MSAA | MSAA | MSAA | Name | Name | Name |

`MSAA` means present in `accValue` but absent from UIA `Name`. `Name`
means already present in UIA `Name`.

On 26.1, TileView, CardView, LayoutView, `ImageComboBoxEdit` items and
text produced by `CustomColumnDisplayText` follow the same pattern: real
content in MSAA, placeholder or nothing in UIA `Name`.

### How UIA sees these controls

Measured 2026-10-01 with a UIA3 probe that reads every node's
`ProviderDescription` (property 30107) and the value and legacy
properties by ID. Targets: `devexpress-bridge-demo` (DevExpress 26.1),
`winforms-large` and the new `msaa-legacy-controls` fixture (both
stock .NET Framework 4.7.2 WinForms).

- **The whole DevExpress tree is served by UIAutomationCore's MSAA
  Proxy.** DevExpress publishes accessibility through IAccessible only.
  The same holds for the .NET Framework `DataGridView` and for any
  WinForms control with a custom `AccessibleObject`.
- **The MSAA Proxy exposes `ValuePattern` with the same text as
  `accValue`** on most nodes: every DevExpress cell, row and group row,
  every `DataGridView` cell. So for these elements `Value` and
  `LegacyValue` are equal, and `windows: getValue` already returns the
  content today.
- **Except rows.** `DataGridView` rows (`ROLE_SYSTEM_ROW`, control type
  `Custom`) and its header row have `accValue`
  (`db-01;Database;US East;Degraded`) but **no** `ValuePattern`. Here
  only `LegacyValue` carries the content. This is why both attributes
  are needed.
- **No `ExpandCollapsePattern` on expandable MSAA items.** DevExpress
  group rows and TreeList nodes, and the fixture's outline groups, set
  `STATE_SYSTEM_EXPANDED` / `STATE_SYSTEM_COLLAPSED` and a default
  action of "Expand" / "Collapse", but the proxy does not map that to
  `ExpandCollapsePattern`. `LegacyState` is the only source of truth.
  A stock `TreeView` goes through UIA's native TreeView proxy instead
  and does get the pattern.
- **`SelectionItemPattern` does not mean selectable.** The proxy gives
  the pattern to outline items and DevExpress rows regardless of
  `STATE_SYSTEM_SELECTABLE`. On a non-selectable group, `Select()`
  succeeds and changes nothing. `DataGridView` cells get no
  `SelectionItemPattern` at all, but `LegacyIAccessible.Select` works on
  them.
- **The proxy does not hide protected values.** A control with
  `STATE_SYSTEM_PROTECTED` gets `IsPassword = true`, but if its
  `accValue` returns the secret, both `Value` and `LegacyValue` return
  it. The stock password `TextBox` returns an empty value because the
  OS edit control refuses; a custom legacy control does not.

The behaviour is not DevExpress-specific: the licence-free fixture shows
the same shape through the same proxy. Other MSAA-only stacks (VB6,
Delphi, older MFC) are expected to match; confirm against one when
available.

## Goals

- Expose UIA `ValuePattern.Value` and the `LegacyIAccessible` value
  through every read path: page source, XPath, find conditions and
  `getAttribute`.
- Enabled by default, with no plugin and no new capability required.
- No change to existing attributes, so no existing locator breaks.
- Make `select`, `expand` and `collapse` verify their effect and either
  succeed for real or fail with `InvalidElementState`, end to end
  (server and client).
- Do not leak password field contents into page source or logs.
- Keep page-source and XPath performance within the agreed budget.

## Non-goals

- Reading anything that is not in standard accessibility (owner-drawn
  content with no accessible value, off-screen virtualised rows). That
  remains the job of in-process bridges.
- Changing `Name`, or merging the value into `Name`.
- Fixing the existing attribute-name casing mismatch between page source
  (`HasKeyboardfocus`, `IsContentelement`, ...) and XPath
  (`HasKeyboardFocus`, `IsContentElement`, ...). Do not copy it into the
  new attributes. Track it separately.

## Design

### Step 0: fix the COM interop declarations

This must land first. Everything below reads through these interfaces.
All interface GUIDs and member orders in `Uia3/UIA.cs` were compared
with `UIAutomationClient.h` (Windows SDK 10.0.26100). Four are wrong;
the rest match.

#### LegacyIAccessible method order

`IUIAutomationLegacyIAccessiblePattern` in `Uia3/UIA.cs` declares its
methods in the wrong order. A `[ComImport]` interface must list methods
in exactly the vtable order of `UIAutomationClient.h`, so calls land on
the wrong slot today:

| Slot | Declared in `UIA.cs` | Real method in the header |
| --- | --- | --- |
| 3 | `GetIAccessible` | `get_CurrentChildId` |
| 4 | `CurrentChildId` | `get_CurrentName` |
| 5 | `get_CurrentName` | `get_CurrentValue` |
| 6 | `get_CurrentValue` | `get_CurrentDescription` |
| 7-10 | Role, State, Help, Shortcut | same (aligned by luck) |
| 11 | `get_CurrentDefaultAction` | `GetCurrentSelection` |

Consequences:

- `Select`, `DoDefaultAction` and `CurrentState` work today only
  because their slots happen to line up.
- `get_CurrentValue()` returns the Description and `get_CurrentName()`
  returns the Value. Confirmed live on a `DataGridView` cell whose
  `LegacyName` is `note Row 1` and `LegacyValue` is `note for row 1`:
  the current declaration returns `note for row 1` from
  `get_CurrentName()` and `""` from `get_CurrentValue()`.
- `GetIAccessible()` is really the last slot (23).

Fix: redeclare the whole interface from the header, including the
`Current*` and `Cached*` members and `GetIAccessible` last. The full
order is in the [appendix](#appendix-legacyiaccessible-vtable-order).
Add a test that reads `Name` and `Value` through the pattern and
compares them with the property values (see [Test plan](#test-plan)).

#### Wrong interface GUIDs

- `IUIAutomationInvokePattern`
  - in `UIA.cs`: `FB377FBE-8EA6-46D5-9C73-6499CAD4B1A3`
  - in the header: `fb377fbe-8ea6-46d5-9c73-6499642d3059`
- `IUIAutomationRangeValuePattern`
  - in `UIA.cs`: `0E0D7C4C-3F80-11D9-8B6C-00065B84C5EA`
  - in the header: `59213f4f-7346-49e5-b120-80555987a148`

With the wrong GUID, `GetCurrentPattern(...) is IUIAutomationXPattern`
is always false, because the cast asks the COM object for an interface
it does not have:

- `invokeElement` never calls `InvokePattern.Invoke()`. It falls
  through to `SelectionItemPattern.Select()` and then
  `LegacyIAccessible.DoDefaultAction()`. On an element with both
  patterns (every MSAA-proxied group row), invoke selects instead of
  invoking: measured as "ok, no effect" on the fixture.
- `setElementRangeValue` always throws "Element does not support
  RangeValuePattern".

Fix both GUIDs here because the verified-action work depends on correct
pattern dispatch. For plain buttons nothing visible changes: UIA gives
almost every element a LegacyIAccessible pattern whose default action
is "Press", so the fallback already pressed them (this is why the
Calculator invoke tests always passed). What changes is elements that
expose both `InvokePattern` and `SelectionItemPattern` (list items, tab
items, tree items, MSAA-proxied rows): invoke now invokes instead of
selecting. Call it out in a `fix:` commit.

#### IUIAutomation tail order

Found by the reflection test during implementation. After
`RemoveAllEventHandlers`, `IUIAutomation` declared
`IntSafeArrayToNativeArray` and `IntNativeArrayToSafeArray` swapped,
then jumped to `CheckNotSupported` and the `ElementFromIAccessible`
methods, skipping eleven header slots (`RectToVariant` …
`PollForPotentialSupportedProperties`). Every one of those declarations
sat on the wrong slot. None were called anywhere, so the fix drops the
tail: declaring a prefix of an interface is safe because undeclared
slots are never called.

#### Guard

`csharp/WincoreServer.Tests/UiaInteropTests.cs` checks every
`[ComImport]` interface's IID and member order against data generated
from the header. It caught the `IUIAutomation` tail and fails on any
future drift.

### New attributes

Add these attributes with identical spelling in page source, XPath
documents and the property map:

| Attribute | Source | Property ID |
| --- | --- | --- |
| `Value` | `ValuePattern.Value` | `UIA_ValueValuePropertyId` |
| `LegacyValue` | `LegacyIAccessible.Value` | `..LegacyIAccessibleValue..` |
| `LegacyName` | `LegacyIAccessible.Name` | `..LegacyIAccessibleName..` |
| `LegacyDescription` | `LegacyIAccessible.Description` | `..Description..` |
| `LegacyRole` | `LegacyIAccessible.Role` | `..Role..` |
| `LegacyState` | `LegacyIAccessible.State` | `..State..` |

The full property IDs are in the [appendix](#appendix-property-ids).

`Value` and `LegacyValue` are usually equal on MSAA-proxied elements,
because the proxy builds `ValuePattern` from `accValue`. They differ on
rows (`DataGridView` rows carry content only in `LegacyValue`) and on
UIA-native elements where UIA core synthesises the legacy pattern.
Both are kept.

Also add `ProviderDescription` (`UIA_ProviderDescriptionPropertyId`,
30107) to the property map, for `getAttribute` only (not page source or
XPath: the string is long and holds process-specific ids). Tests use it
to check that a fixture element is really served by the MSAA Proxy, and
users can use it to diagnose why an element behaves the way it does.

Rules:

- Read values from the cached property, so they cost no extra
  cross-process call per element (see [Performance](#performance)).
  The live fallback builders read them with `GetCurrentPropertyValue`,
  not through the pattern interface.
- If the pattern is not supported, emit an empty string, as `HelpText`
  already does. Keep the attribute set the same on every node so XPath
  behaves predictably. An unsupported property comes back as UIA's
  "not supported" sentinel object, which must map to `""`.
- `LegacyRole` and `LegacyState` are numbers. Emit them as decimal
  strings. Page source's `CStr` helper uses `as string` and would emit
  `""` for an integer, so the numeric attributes need an explicit
  integer-to-string read (XPath's `ReadCached` already does this).
- Sanitise every value so control characters cannot break the XML.
  `Sanitize` is private to `UiaXmlModel` today and page source never
  sanitises anything, not even `Name`. Move it to a shared helper and
  apply it in all four builders (see below).
- **Password fields:** when `IsPassword` is true, emit `Value` and
  `LegacyValue` as `""` in page source and XPath. This follows UIA's
  rule that password values are not exposed and keeps secrets out of
  page source dumps and logs. `IsPassword` is already in both cache
  requests. This is not hypothetical: the fixture's legacy PIN box
  (`STATE_SYSTEM_PROTECTED`) reports `IsPassword = true` and still
  returns its PIN from both `Value` and `LegacyValue` (see
  [How UIA sees these controls](#how-uia-sees-these-controls)).
- **Length cap:** `ValuePattern.Value` on a RichEdit or Document returns
  the whole text. In page source and XPath, truncate `Value` and
  `LegacyValue` to 4096 characters. `getAttribute` still returns the
  full value. The cap is a constant, not a capability.

### getAttribute compatibility aliases

`getAttribute` / `getProperty` should also accept pattern-qualified names,
so users migrating from WinAppDriver-style tests do not have to rewrite
them. Confirm WinAppDriver's exact spelling before shipping.

| Alias | Maps to |
| --- | --- |
| `Value.Value` | `Value` |
| `Value.IsReadOnly` | `UIA_ValueIsReadOnlyPropertyId` |
| `LegacyIAccessible.Value` | `LegacyValue` |
| `LegacyIAccessible.Name` | `LegacyName` |
| `LegacyIAccessible.Description` | `LegacyDescription` |
| `LegacyIAccessible.Role` | `LegacyRole` |
| `LegacyIAccessible.State` | `LegacyState` |
| `LegacyIAccessible.DefaultAction` | default action property |

Aliases are `getAttribute`-only. Page source and XPath use the short
names from the table above.

Return types: `ElementCommands.GetProperty` currently returns plain
integers for integer properties (for example `ProcessId`). Keep that
rule: `LegacyRole` and `LegacyState` return integers from
`getAttribute`, like every other integer property. Only page source and
XPath emit them as strings, because XML attributes are strings.
Appium's client already stringifies attribute values.

`getAttribute` is not affected by the password rule or the length cap.
It reads one element on explicit request, as `windows: getValue`
already does.

### Where the changes go

| Area | File | Change |
| --- | --- | --- |
| COM interface | `Uia3/UIA.cs` | fix vtable order (step 0) |
| Property IDs | `Uia3/UIA.cs` | add the constants |
| Property map | `Server/ConditionBuilder.cs` | names and aliases |
| getAttribute | `Commands/ElementCommands.cs` | new names |
| Page source | `Commands/PageSourceCommands.cs` | both builders |
| XPath | `Commands/XPathCommands.cs` | add to `Attributes` |
| Sanitising | new shared helper | used by all builders |
| Actions | `Commands/PatternCommands.cs` | verified actions |
| Error code | `Protocol/ErrorCodes.cs` | `InvalidElementState` |
| Error mapping | `Server/JsonRpcServer.cs` | exception to code |
| Error mapping | `lib/server/client.ts` | code to WebDriver error |
| Client actions | `lib/commands/extension.ts` | stop masking errors |
| Locators | `lib/server/conditions.ts` | casing normalisation |
| Locator types | `lib/powershell/types.ts` | new property names |
| Docs | `README.md`, `API.md` | list the attributes |

Notes:

- `ConditionBuilder.PropertyMap` feeds both `getAttribute` and find
  conditions. Adding the names there makes
  `findElement('-windows uiautomation', ...)` style conditions work too.
  The comment on `PropertyMap` requires keeping `conditions.ts` and
  `lib/powershell/types.ts` in sync.
- `conditions.ts` already passes unknown property names through
  unchanged, so new names reach the server today. The change there is
  adding lowercase entries to its normalisation map, so any casing
  resolves to the canonical name.
- Page source has a cached builder (`BuildPageSourceCached`) and a live
  fallback (`BuildPageSource`). XPath has a cached builder and a live
  builder (`BuildElementCached` / `BuildElementLive`, reading through
  `ReadCached` / `ReadLive`). All four must emit the new attributes.
- `CHANGELOG.md` is generated by semantic-release (`.releaserc`). Do not
  edit it by hand. Use a `feat:` commit so the release notes pick the
  change up.

### Performance

Measured 2026-10-01 with the unchanged `test/perf/uia-pagesource.perf.ts`
suite (`wpf-large`, ~3,036 UIA nodes, p50 of 5 iterations).

The first implementation added all six properties to both cache
requests and failed the budget:

| Op | Old | All six cached | Change |
| --- | --- | --- | --- |
| `getPageSource` | 6,248 ms | 11,722 ms | +88% |
| `findAll-star` | 7,850 ms | 13,223 ms | +68% |
| `find-anchorLast` | 6,044 ms | 11,282 ms | +87% |

Cause, isolated by timing the page-source walk with one property group
added at a time:

- `Value` costs +1%. All five `LegacyIAccessible` properties together
  cost +79% on `wpf-large` (`LegacyState` alone +30%).
- On an MSAA-backed tree (`winforms-large`) the same five cost about
  +10%.
- WPF has its own UIA provider and no MSAA object behind it. UIA core
  synthesises each legacy property from the element's real UIA
  properties, which means extra calls into the app per property, per
  element. The synthesised values only repeat `Name` / `Value`.

Design that ships:

- Two per-level cache requests: full (with the legacy properties) and
  lean (without). Children of a WPF / XAML / DirectUI element are
  fetched lean. A child that is itself not native UIA (a WinForms
  control hosted in WPF, an MSAA-proxied title bar) is re-fetched with
  the full request. On `wpf-large` that is one node out of 3,036.
- Native-UIA elements emit the `Legacy*` attributes as `""`. The live
  fallback builders apply the same rule per element.
- `Value` is fetched everywhere. `getAttribute` reads any property
  live on any element, unaffected.
- No capability needed.

Result with the same suite:

| Op | Old | Shipped | Change |
| --- | --- | --- | --- |
| `getPageSource` | 6,248 ms | 6,554 ms | +4.9% |
| `findAll-star` | 7,850 ms | 8,002 ms | +1.9% |
| `find-anchorLast` | 6,044 ms | 6,200 ms | +2.6% |
| `getAttribute` x50 | 690 ms | 674 ms | -2.3% |

The suite's own gate (3x the baseline) would have passed the first
implementation. Keep checking the 15% budget by comparing against an
A/B run, not the gate.

### State-verified actions

Change `Commands/PatternCommands.cs` so `select`, `expand` and
`collapse` never report success when nothing changed, and make sure the
client passes the failure through.

#### Error plumbing

There is no `InvalidElementState` path today:

- `Protocol/ErrorCodes.cs` has no such code.
- `JsonRpcServer.cs` maps `InvalidOperationException` to
  `PatternNotSupported` when the message contains "Pattern", otherwise
  to `InternalError`.
- `lib/server/client.ts` maps both to `UnknownError`.

Add:

1. `ErrorCodes.InvalidElementState`.
1. A dedicated exception type (for example
   `InvalidElementStateException`) that `JsonRpcServer` maps to that
   code. Do not rely on message text.
1. A `client.ts` case that rejects with
   `errors.InvalidElementStateError`.

#### Revision after review: verify MSAA actions only

The first implementation verified every action afterwards, including
real UIA pattern calls. Review showed that this caused more problems
than it solved:

- an element re-created on expand (DevExpress) or a closed popup was
  reported as a failure;
- a provider that updates its state slowly timed out, then the default
  action ran and could toggle the control back;
- a failed command paid the polling budget twice (~1.1 s).

Every silent no-op found while building this came from MSAA (the MSAA
Proxy's synthesised patterns and `DoDefaultAction` report success
whether or not anything happened), never from a native provider's
pattern. A native pattern's contract is to throw when it cannot act.

What ships:

- The state is read before acting, as specified below; this is what
  fixes the toggle bug.
- On native-UIA elements a pattern call that does not throw is
  success: no check afterwards, no fallback.
- On MSAA-backed elements (`ProviderDescription` contains
  `MSAA Proxy`) the action is checked once, within one 600 ms budget
  per command. Only `UIA_E_ELEMENTNOTAVAILABLE` counts as "the element
  is gone, so done"; a timeout or access error does not.
- The `LegacyIAccessible.Select` and `DoDefaultAction` fallbacks run on
  MSAA-backed elements only. UIA core synthesises LegacyIAccessible
  (and a "Press" default action) for native elements too, so `collapse`
  on a WPF Button must not click it and `select` on it must stay
  "not supported".

The steps below describe the MSAA path.

#### Select

1. If `SelectionItemPattern` is available, call `Select()`, then re-read
   `CurrentIsSelected`. Done if it is selected.
1. Otherwise, or if the selection did not take, fall back to
   `LegacyIAccessible.Select(SELFLAG_TAKEFOCUS | SELFLAG_TAKESELECTION)`
   and re-check through `IsSelected` or `LegacyState`
   (`STATE_SYSTEM_SELECTED`).
1. If still not selected, throw
   `InvalidElementState: select had no effect on this element`.

`patternSelect` in `extension.ts` has no client-side fallback, so the
error reaches the caller once the plumbing above exists.

Notes from the fixture:

- Step 1 runs on elements that are not selectable at all: the MSAA
  Proxy gives `SelectionItemPattern` to outline items and grid rows
  whatever their state. That is why step 1 must re-read
  `CurrentIsSelected` instead of trusting the call.
- Step 2 is what makes `DataGridView` cells selectable (they have no
  `SelectionItemPattern`). Measured: `LegacyState` goes from `0x300040`
  to `0x300046` (SELECTED and FOCUSED) and the grid's selection follows.
- The element's own state is the ground truth, which gives one known
  false negative: in `CellSelect` mode, selecting a `DataGridView` row
  moves the current cell into that row but never sets SELECTED on the
  row, so the driver reports `InvalidElementState` even though the grid
  changed. Accept this and document it: the row was not selected.

#### Expand and collapse

Where the state comes from:

- If `IsExpandCollapsePatternAvailable` is true, use the pattern's
  `CurrentExpandCollapseState`.
- Otherwise use `LegacyState` (`STATE_SYSTEM_EXPANDED` /
  `STATE_SYSTEM_COLLAPSED`). If neither bit is set, the element reports
  no state.
- **Never read `UIA_ExpandCollapseExpandCollapseStatePropertyId` on its
  own.** On an element without the pattern, UIA returns the property's
  default value, `LeafNode` (3). Measured: every MSAA-proxied group row
  reads as `LeafNode`. Gate the read on the pattern being available.

Treat `PartiallyExpanded` as expanded, matching the client's existing
`isExpanded`.

1. Read the current state first.
1. If the pattern is available and reports `LeafNode`, throw
   `InvalidElementState` (nothing to expand or collapse). Do not treat
   it as "already in the requested state". A `LeafNode` that comes from
   the default value (no pattern) is "no state", not a leaf.
1. If the element is already in the requested state, return without
   acting. This removes the "expand collapses it" toggle bug.
1. Call `ExpandCollapsePattern.Expand()` / `Collapse()`, then re-read
   the state.
1. If the state did not change and the element is still in the opposite
   state, fall back to `LegacyIAccessible.DoDefaultAction()` once and
   re-read again.
1. If the element reports a state and it still did not change, throw
   `InvalidElementState`. If the element reports no state at all, keep
   today's behaviour (act and log) so controls that never set the bit do
   not regress.
1. Give `collapse` the same `LegacyIAccessible` fallback `expand`
   already has.

Also fix `getProperty('ExpandCollapseState')` in `ElementCommands.cs`.
Today it falls back to the raw property when the pattern is missing, so
it returns `"LeafNode"` for every MSAA-only expandable element, and the
client then sends ALT+Down. Change the fallback order to: pattern, then
`LegacyState` bits (`Expanded` / `Collapsed`), then throw "Element does
not support ExpandCollapsePattern" (which the client already treats as
"can't verify"). Drop the raw-property fallback.

On the fixture, after this change, the outline groups read `Expanded` /
`Collapsed` from `LegacyState`, the "Archive" group (never sets the
bits) throws, and the stock `TreeView` node still reads from its
pattern.

#### Client changes in `extension.ts`

`patternExpand` and `patternCollapse` catch every server error and fall
back to ALT+Down, then return success. Left as is, they would turn the
new `InvalidElementState` into an ALT+Down sent to a grid row and a
silent success.

Change both functions:

- If the server error is `InvalidElementState`, rethrow it, unless the
  element's control type is `ComboBox`. ALT+Down is a combo-box keyboard
  trick: it was added for legacy Win32 combos whose `Expand()` succeeds
  without opening them, and those now fail server-side verification
  too. Keep the fallback for them; for any other control (or when the
  control type can't be read) surface the error and send no keys.
- Keep the ALT+Down fallback for every other server error
  (`PatternNotSupported`, tree-provider errors), and for the case where
  the server succeeded but the state is confirmed unchanged.
- Since the server now verifies state, the client's post-call polling
  (`waitForExpanded` / `waitForCollapsed`) is a second check, not the
  only one. Keep it for the ALT+Down decision; do not add new fallbacks.

#### Existing bug to fix along the way

`Expand` treats MSAA state bit `0x1000` as "expanded". That is
`STATE_SYSTEM_FLOATING`. `STATE_SYSTEM_EXPANDED` is `0x200` and
`STATE_SYSTEM_COLLAPSED` is `0x400`. Verified against `oleacc.h` and
`WinUser.h` in Windows SDK 10.0.26100.

#### Known limitation, out of scope here

`expand` on a TreeList cell (`DataItem`) does nothing because the cell is
not the expandable node. Its parent `TreeItem` expands correctly. With
the verification above, the call fails with `InvalidElementState`
instead of succeeding silently. Resolving to the parent row
automatically can be a follow-up.

## Test plan

### Fixtures

All in the sibling repo `appium-wincore-test-apps`.

- **`msaa-legacy-controls` (new, primary, licence-free).** .NET
  Framework 4.7.2 WinForms, no third-party code. Every element is served
  to UIA by the MSAA Proxy (checked through `ProviderDescription` on
  every node), except the stock `TreeView`, which is the UIA-native
  contrast. Built by `npm run build:msaa-legacy-controls-test-app`;
  output `msaa-legacy-controls/bin/x64/Debug/net472/MsaaLegacyControls.exe`.
  Contents:
  - `serversGrid`: stock `DataGridView`, `CellSelect` mode. Columns
    Host / Role / Region / Status; rows `web-01`, `db-01`, `api-03`,
    `queue-01`. Cells have placeholder names (`Status Row 1`) and the
    real content in `accValue` (`Degraded`).
  - `legacyOutline`: custom control with an IAccessible-only tree.
    Four group rows, all named `Group Row`, values `Region: US East`
    (expanded), `Region: EU West` (collapsed), `Region: Archive`
    (toggles but never sets EXPANDED/COLLAPSED) and `Region: Locked`
    (reports COLLAPSED, default action does nothing). Groups are not
    selectable. Items are named `Host row N`, values `web-01`, `db-01`,
    `api-03`, `cache-01`, `old-01`, `vault-01`, and are selectable.
  - `pinBox`: legacy control with `STATE_SYSTEM_PROTECTED` whose
    `accValue` returns the PIN `4721`.
  - `passwordBox`: stock `TextBox`, `UseSystemPasswordChar`, text
    `hunter2`.
  - `nativeTree`: stock `TreeView` with one collapsed node
    `Datacenters`.
  - Status label (AutomationId `statusLabel`) that echoes every
    effect. Tests assert on this text, not on accessibility state
    alone. Example:

    ```text
    Grid: db-01/Status | Outline selected: db-01 |
    Outline expanded: US East,EU West | Tree: collapsed
    ```

    (one line in the app; wrapped here).
- **`devexpress-bridge-demo`** (DevExpress 26.1, needs a licence):
  the original reproduction. Run where a licence is available; CI
  coverage comes from `msaa-legacy-controls`.
- **`winform-combo`, `wpf-minimal`**: UIA-native regression check that
  nothing changes where `Name` is already right.
- **`wpf-large`, `winforms-large`** (and the DevExpress grid) for
  performance.

The driver's e2e helper (`test/e2e/helpers/session.ts`) needs an
`MSAA_LEGACY_CONTROLS_APP_PATH` constant next to
`WINFORMS_LARGE_APP_PATH`.

Uncommitted work in the test-apps repo must be committed before CI
relies on it:

- `msaa-legacy-controls/` and its `build:msaa-legacy-controls-test-app`
  script, `.gitignore` and README entries
- `devexpress-bridge-demo/`
- `wpf-large/`
- `java-swing-controls/`
- `scripts/build-devexpress-bridge-demo-test-app.js`
- the rest of the pending `package.json` and `.gitignore` changes

### Unit tests

- Property map resolves the new names and every alias,
  case-insensitively.
- `conditions.ts` normalises any casing of the new names.
- `LegacyRole` and `LegacyState` serialise as decimal strings in page
  source and XPath, and as integers from `getAttribute`.
- The "not supported" sentinel maps to `""`.
- Sanitisation of values with control characters, in both page source
  and XPath.
- Truncation at 4096 characters in page source and XPath only.
- Password rule: `Value` / `LegacyValue` empty when `IsPassword` is
  true.
- `client.ts` maps `InvalidElementState` to
  `errors.InvalidElementStateError`.
- `patternExpand` / `patternCollapse` rethrow `InvalidElementState`
  without sending ALT+Down, and still fall back on
  `PatternNotSupported`.
- `getProperty('ExpandCollapseState')` never returns the raw default
  (`LeafNode`) for an element without the pattern.

C# (`csharp/WincoreServer.Tests`, no live app needed):

- For every `[ComImport]` interface in `Uia3/UIA.cs`, the GUID equals
  the one in `UIAutomationClient.h`, and the declared member order (by
  metadata token) matches the header's vtable order. Hard-code the
  expected lists from the header. This catches the LegacyIAccessible,
  Invoke and RangeValue defects and any future one.

### End-to-end tests

Against `msaa-legacy-controls`, plain driver, no plugins. Every
expected value below was observed with the UIA probe on 2026-10-01.
The "today" column is what the current driver does, so each test is
known to fail before the change.

Fixture sanity (run first, fail fast if the OS or framework changes how
the fixture is exposed):

- `getAttribute('ProviderDescription')` on the `Status Row 1` cell and
  on an outline group contains `MSAA Proxy`; on the `Datacenters`
  TreeView node it contains `TreeView Item Proxy`.

Reading values:

Each bullet gives the expected result, then what the driver does
today.

- Page source, cell `Status Row 1`: `Value` and `LegacyValue` are
  `Degraded`. Today: neither attribute exists.
- Page source, grid row `Row 1`: `LegacyValue` is
  `db-01;Database;US East;Degraded` and `Value` is `""` (the proxy
  gives rows no `ValuePattern`). Today: absent.
- `//Edit[@LegacyValue='Degraded']`: exactly one match,
  `Status Row 1`. Today: no match (`//*[@Value='Degraded']` also
  returns nothing).
- `//Custom[starts-with(@LegacyValue,'db-01;')]`: `Row 1`. Today: no
  match.
- Outline item `Host row 2`: `LegacyValue` is `db-01`. Today: absent.
- `getAttribute('LegacyIAccessible.Value')` and
  `getAttribute('Value.Value')` on the cell: `Degraded`. Today:
  `InvalidArgument: Unknown automation property`.
- `getAttribute('LegacyRole')` on the cell: `29`
  (`ROLE_SYSTEM_CELL`). Today: `InvalidArgument`.
- `getAttribute('LegacyState')` on `Region: EU West`: includes
  `0x400`; after expanding, `0x200`. Today: `InvalidArgument`.
- Find condition `LegacyValue = 'db-01'`: the grid cell and the
  outline item. Today: `InvalidArgument`.

Password rule:

- Page source and XPath show `Value=""` and `LegacyValue=""` on
  `pinBox`, and the string `4721` appears nowhere in the page source.
  Today the proxy returns `4721` for both properties, so without the
  rule the new attributes would leak it.
- `passwordBox` shows empty values too (the OS already refuses).

Select (status label is the check):

- `windows: select` on outline item `Host row 2` (has the pattern,
  selectable): succeeds, label shows `Outline selected: db-01`.
- `windows: select` on grid cell `Status Row 1` (no pattern, MSAA
  select only): succeeds through the legacy fallback, label shows
  `Grid: db-01/Status`. Today: `PatternNotSupported`.
- `windows: select` on an outline group (has the pattern, not
  selectable): throws `InvalidElementState`, label unchanged. Today:
  silent success.

Expand and collapse (status label and child count are the checks):

- `windows: expand` on `Region: EU West` (collapsed): succeeds, label
  lists `EU West`, the group now has children `api-03`, `cache-01`.
- `windows: expand` again: no change, still expanded (no toggle).
- `windows: expand` on `Region: US East` (already expanded): no change.
  Today: collapses it.
- `windows: collapse` on `Region: US East`: succeeds, label no longer
  lists `US East`, its children are gone. Today: `PatternNotSupported`,
  then the client sends ALT+Down.
- `windows: expand` on `Region: Locked`: throws `InvalidElementState`,
  and no ALT+Down is sent. Today: silent success.
- `windows: expand` on `Region: Archive` (never reports state): acts
  and succeeds, label lists `Archive`. This is the no-regression case.
- `getAttribute('ExpandCollapseState')`: `Collapsed` / `Expanded` on
  groups through `LegacyState`; throws on `Region: Archive`. Today:
  `LeafNode` on every group.
- `windows: expand` on the `Datacenters` TreeView node: succeeds through
  `ExpandCollapsePattern`, label shows `Tree: expanded`.

Invoke (after the GUID fix):

- `windows: invoke` on `Region: EU West`: the default action runs
  through `InvokePattern` and the group expands. Today: silent no-op
  (falls through to `SelectionItemPattern.Select()`).

Regression:

- Existing locators on `Name` keep working unchanged on all fixtures.
- The existing e2e suite passes after the Invoke GUID fix.

Against `devexpress-bridge-demo` when a licence is available, repeat the
value, select and group expand/collapse checks:

- page source carries `LegacyValue="Degraded"` on `Status row 2`
- `LegacyValue="EU West"` on TreeList `Name row 1`
- `windows: select` on the `db-01` row sets `SelectionLabel` to
  `Selected server: db-01`
- `windows: expand` on a TreeList cell throws `InvalidElementState`

### Performance tests

- `npm run test:perf` before and after on `wpf-large`, recorded in the
  PR description, within the 15% budget (see
  [Performance](#performance) for the numbers). `wpf-large` stays the
  suite's fixture: native UIA is the worst case for this change, which
  is exactly what regressed.

## Acceptance criteria

- [ ] `IUIAutomationLegacyIAccessiblePattern` matches the SDK vtable
  order, and the Invoke and RangeValue GUIDs match the SDK, with the
  reflection test guarding all interfaces.
- [ ] `msaa-legacy-controls` is committed in the test-apps repo and the
  e2e tests above run against it with no licence.
- [ ] `Value`, `LegacyValue`, `LegacyName`, `LegacyDescription`,
  `LegacyRole`, `LegacyState` appear in page source (cached and live)
  and XPath (cached and live), with the same spelling.
- [ ] The same names, plus the aliases, work in `getAttribute` and find
  conditions.
- [ ] Appium Inspector shows `LegacyValue` on DevExpress grid and tree
  cells with no plugin installed.
- [ ] Password values are empty in page source and XPath; long values
  are truncated there.
- [ ] `select`, `expand` and `collapse` either have a verified effect or
  reach the caller as `InvalidElementState`. None silently succeed on
  the fixture, and the client does not mask the error with ALT+Down.
- [ ] The `0x1000` state-bit bug is fixed.
- [x] Performance stays within the 15% budget on `wpf-large` (native
  UIA, the worst case), with no opt-out capability needed.
- [ ] `README.md` and `API.md` are updated. Release notes come from the
  commit message, not a manual `CHANGELOG.md` edit.

## Open questions

- Should `Value` fall back to `LegacyValue` when `ValuePattern` is
  absent, so users have one attribute to learn? This spec keeps them
  separate to avoid hiding where a value came from.
- Should `LegacyRole` / `LegacyState` be emitted as names
  (`ROLE_SYSTEM_CELL`, `SELECTED|FOCUSED`) rather than numbers?
  `AccessibilityCommands.cs` already has a role-to-name table that could
  be reused.
- Should `getText` fall back to `LegacyValue` when it would otherwise
  return `Name`, for elements like DevExpress cells whose `Name` is a
  placeholder? That changes existing `getText` results, so it needs a
  rule for when `Name` counts as a placeholder.
- Is 4096 characters the right truncation cap?
- Should the password rule also apply to `getAttribute`? The fixture
  shows a legacy control leaking its secret through both properties,
  and `windows: getValue` already returns it today. This spec keeps
  `getAttribute` unfiltered because it is an explicit read.
- Should `select` on a grid row that only moves the current cell
  (`DataGridView` in `CellSelect` mode) count as success? This spec
  says no, the row's own state decides.
- Exact WinAppDriver alias spelling, to confirm before release.
- Should the attribute be emitted only when non-empty to keep page
  source smaller? This spec says always emit, for predictable XPath.

## Appendix: property IDs

Verified against `UIAutomationClient.h` in Windows SDK 10.0.26100.

| Constant | Value |
| --- | --- |
| `UIA_ValueValuePropertyId` | 30045 |
| `UIA_ValueIsReadOnlyPropertyId` | 30046 |
| `UIA_ExpandCollapseExpandCollapseStatePropertyId` | 30070 |
| `UIA_SelectionItemIsSelectedPropertyId` | 30079 |
| `UIA_IsLegacyIAccessiblePatternAvailablePropertyId` | 30090 |
| `UIA_LegacyIAccessibleNamePropertyId` | 30092 |
| `UIA_LegacyIAccessibleValuePropertyId` | 30093 |
| `UIA_LegacyIAccessibleDescriptionPropertyId` | 30094 |
| `UIA_LegacyIAccessibleRolePropertyId` | 30095 |
| `UIA_LegacyIAccessibleStatePropertyId` | 30096 |
| `UIA_LegacyIAccessibleDefaultActionPropertyId` | 30100 |

MSAA flags used above (from `oleacc.h`, verified):

| Constant | Value |
| --- | --- |
| `STATE_SYSTEM_SELECTED` | `0x2` |
| `STATE_SYSTEM_EXPANDED` | `0x200` |
| `STATE_SYSTEM_COLLAPSED` | `0x400` |
| `STATE_SYSTEM_FLOATING` | `0x1000` |
| `SELFLAG_TAKEFOCUS` | `0x1` |
| `SELFLAG_TAKESELECTION` | `0x2` |

## Appendix: LegacyIAccessible vtable order

From `UIAutomationClient.h`, Windows SDK 10.0.26100. Slots after the
three `IUnknown` methods:

1. `Select`
1. `DoDefaultAction`
1. `SetValue`
1. `get_CurrentChildId`
1. `get_CurrentName`
1. `get_CurrentValue`
1. `get_CurrentDescription`
1. `get_CurrentRole`
1. `get_CurrentState`
1. `get_CurrentHelp`
1. `get_CurrentKeyboardShortcut`
1. `GetCurrentSelection`
1. `get_CurrentDefaultAction`
1. `get_CachedChildId`
1. `get_CachedName`
1. `get_CachedValue`
1. `get_CachedDescription`
1. `get_CachedRole`
1. `get_CachedState`
1. `get_CachedHelp`
1. `get_CachedKeyboardShortcut`
1. `GetCachedSelection`
1. `get_CachedDefaultAction`
1. `GetIAccessible`
