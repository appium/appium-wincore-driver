# Extension Commands

Invoke all extension commands via `executeScript`:

```js
await driver.executeScript('windows: <command>', [args]);
```

Pattern commands that take a single element accept the element
reference directly as the first array item:

```js
const btn = await driver.$('~myButton');
await driver.executeScript('windows: invoke', [btn]);
```

## windows: click

Simulates a mouse click at a screen coordinate or on a UI element.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `elementId` | string | no | Click element center; coords become relative |
| `x` | number | no | Horizontal coordinate |
| `y` | number | no | Vertical coordinate |
| `button` | string | no | `left` (default), `middle`, `right`, `back`, `forward` |
| `modifierKeys` | string/string[] | no | Hold keys: `shift`, `ctrl`, `alt`, `win` |
| `durationMs` | number | no | Hold time between press and release |
| `times` | number | no | Repeat count. Default: `1` |
| `interClickDelayMs` | number | no | Delay between clicks. Default: `100` ms |

## windows: hover

Moves the mouse from a start position to an end position.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `startElementId` | string | no | Move from element center |
| `startX` | number | no | Start X coordinate |
| `startY` | number | no | Start Y coordinate |
| `endElementId` | string | no | Move to element center |
| `endX` | number | no | End X coordinate |
| `endY` | number | no | End Y coordinate |
| `modifierKeys` | string/string[] | no | Hold keys during move |
| `durationMs` | number | no | Duration. Default: `500` ms |

## windows: scroll

Mouse wheel scroll. Provide either `deltaX` or `deltaY`.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `elementId` | string | no | Scroll relative to element center |
| `x` | number | no | Scroll point X |
| `y` | number | no | Scroll point Y |
| `deltaX` | number | no | Horizontal ticks (negative = left) |
| `deltaY` | number | no | Vertical ticks (negative = toward user) |
| `modifierKeys` | string/string[] | no | Hold keys during scroll |

## windows: clickAndDrag

Press, drag to a target, and release. Provide either
`startElementId` or `startX`+`startY`; same for the end point.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `startElementId` | string | no | Drag start element |
| `startX` | number | no | Drag start X |
| `startY` | number | no | Drag start Y |
| `endElementId` | string | no | Drag end element |
| `endX` | number | no | Drag end X |
| `endY` | number | no | Drag end Y |
| `button` | string | no | Mouse button. Default: `left` |
| `modifierKeys` | string/string[] | no | Hold keys during drag |
| `durationMs` | number | no | Drag duration. Default: `500` ms |

## windows: keys

Sends a sequence of keyboard actions.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `actions` | KeyAction or KeyAction[] | yes | Sequence of key actions |
| `forceUnicode` | boolean | no | Send as Unicode; disables modifier combos |

Each `KeyAction` must contain exactly one of:

| Property | Type | Description |
| --- | --- | --- |
| `pause` | number | Pause in milliseconds |
| `text` | string | Unicode text to type |
| `virtualKeyCode` | number | Windows virtual-key code (e.g. `0x0D` = Enter) |

When using `virtualKeyCode`, the optional `down` boolean presses the
key (`true`), releases it (`false`), or taps it (omit `down`). Always
release any key that was explicitly pressed down.

See the full list of virtual-key codes at
<https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes>.

```js
// Ctrl+A — select all
await driver.executeScript('windows: keys', [{
  actions: [
    { virtualKeyCode: 0x11, down: true },   // Ctrl down
    { virtualKeyCode: 0x41, down: true },   // A down
    { virtualKeyCode: 0x41, down: false },  // A up
    { virtualKeyCode: 0x11, down: false },  // Ctrl up
  ],
}]);
```

## UI Pattern Commands

The following commands each take a single element reference as their
only argument:

| Command | UIA Pattern | Description |
| --- | --- | --- |
| `windows: invoke` | InvokePattern | Activate the element |
| `windows: expand` | ExpandCollapsePattern | Expand the element |
| `windows: collapse` | ExpandCollapsePattern | Collapse the element |
| `windows: toggle` | TogglePattern | Toggle element state |
| `windows: select` | SelectionItemPattern | Select in a list/combo |
| `windows: addToSelection` | SelectionItemPattern | Add to selection |
| `windows: removeFromSelection` | SelectionItemPattern | Remove from selection |
| `windows: scrollIntoView` | ScrollItemPattern | Scroll into view |
| `windows: setFocus` | — | Set keyboard focus |

`windows: select`, `windows: expand` and `windows: collapse` check that
they took effect. If the element still reports the old state, they fail
with `invalid element state` instead of returning success.

How the check works:

- **Real UIA patterns are trusted.** On elements with their own UIA
  provider (WPF, UWP, UIA's built-in Win32 proxies), the command calls
  the pattern and returns success if it doesn't throw.
- **MSAA-backed elements are verified.** DevExpress, the .NET Framework
  `DataGridView`, and VB6 / Delphi / MFC controls reach UIA through the
  MSAA Proxy, whose calls report success whether or not anything
  happened. After acting, the command checks the state once (briefly
  polling). An element that disappears in the meantime (a re-created
  row, a closed popup) counts as done.
- **select:** `SelectionItemPattern`, then on MSAA elements
  `LegacyIAccessible.Select`. The fallback makes `DataGridView` cells
  selectable.
- **expand / collapse:** read the current state first and do nothing
  when the element is already there. MSAA elements without
  `ExpandCollapsePattern` (group rows, legacy tree grids) use their
  default action. An MSAA element that reports no state is acted on
  without verification. One with no state and no default action reports
  "not supported", so the client's ALT+Down fallback runs.
- ComboBoxes keep the ALT+Down fallback, also after `invalid element
  state`.

Behaviour changes from earlier versions:

- `select` / `expand` / `collapse` on MSAA elements fail with
  `invalid element state` where they used to return success without
  effect.
- `expand` on an already expanded MSAA group no longer collapses it.
- `select` without `SelectionItemPattern` on a non-MSAA element fails
  with "does not support SelectionItemPattern", as before. `collapse`
  without `ExpandCollapsePattern` on a non-MSAA element fails the same
  way and never runs the element's default action.
- `getAttribute('ExpandCollapseState')` errors on an element that
  reports no state. It used to return `LeafNode`.
- `windows: invoke` calls the real `InvokePattern`. On elements that
  have both Invoke and SelectionItem it now invokes instead of
  selecting.

### windows: selectFromCombobox

Opens a combo box (or any list / tree container), finds the entry whose
text is exactly `value`, and selects it.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `elementId` | string | yes | The combo box or container element |
| `value` | string | yes | Exact text (`Name`) of the entry to select |

```javascript
await driver.executeScript('windows: selectFromCombobox', [
  {elementId: await combo.elementId, value: 'Finance'},
]);
// or, like windows: setValue, as two arguments:
await driver.executeScript('windows: selectFromCombobox', [combo, 'Finance']);
```

Steps:

1. Expands the container unless it is already open. A container
   without `ExpandCollapsePattern` (a list box, a tree) is searched as
   it is.
1. Asks the container for the entry through UI Automation's
   `ItemContainerPattern`. This reaches entries a virtualized list (WPF)
   has not created yet; the entry is realized (`VirtualizedItemPattern`)
   so it can be selected. A container from a
   [server plugin](../architecture/server-plugins.md) is asked through its tree provider's
   `FindItemInContainer` instead, when the plugin implements it.
1. Otherwise looks for a descendant whose `Name` equals `value`. List,
   data, tree and menu items win over other elements with the same text,
   such as the combo's selection box. WinForms, Win32 and MSAA lists
   expose every entry once open.
1. Selects the entry as `windows: select` does, then closes the popup
   if it is still open.

Name matching is exact (case-sensitive, no partial match). If no entry
matches, the popup is closed and the command fails with
`no such element`. The popup's entries must be descendants of the
container element; a dropdown that opens as a separate top-level window
is not searched.

### windows: setValue

Sets the element value via ValuePattern. Arg 0: element. Arg 1: value string.

### windows: getValue

Returns the element's current value string. Arg 0: element.

### windows: selectedItem

Returns the selected element from a selection container. Arg 0: container element.

### windows: allSelectedItems

Returns all selected elements as an array. Arg 0: container element.

### windows: isMultiple

Returns `true` if the container supports multi-select. Arg 0: container element.

### windows: maximize / minimize / restore / close

Window state control via WindowPattern. Arg 0: window element.

## App and Window Control

### windows: launchApp

Re-launches the app from the `appium:app` capability. No arguments.

### windows: closeApp

Closes the current root application window. No arguments.

### windows: getWindows

Returns all visible top-level windows including **untitled windows** that the standard WebDriver `getWindowHandles()` omits.

Each entry in the returned array contains:

| Field | Type | Description |
| --- | --- | --- |
| `handle` | string | Hex window handle (e.g. `0x000a1234`) — pass directly to `driver.switchToWindow()` |
| `title` | string | Window title. Empty string `""` for untitled windows |
| `className` | string | Win32 window class name (e.g. `Notepad`, `#32770`) |

**Difference from `getWindowHandles()`:** The standard `getWindowHandles()` only returns windows with a non-empty title. `windows: getWindows` returns all visible windows and provides richer metadata, making it possible to locate and switch to untitled popups and dialogs by their class name or handle.

```js
const windows = await driver.executeScript('windows: getWindows', []);
// [
//   { handle: '0x000a1234', title: 'My App', className: 'MyAppWindow' },
//   { handle: '0x000b5678', title: '',        className: '#32770' },
// ]

// Switch to an untitled dialog by class name
const popup = windows.find(w => w.className === '#32770' && w.title === '');
await driver.switchToWindow(popup.handle);
```

### windows: switchToWindowByTitle

Switches the session to a window matched by title. Uses Win32 `EnumWindows` so it always searches all visible top-level windows regardless of where the session is currently rooted.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Title string to match against |
| `exact` | boolean | No | `true` for exact case-insensitive match. Default: `false` (substring match) |

Throws `NoSuchWindowError` if no window matches after the implicit timeout.

```js
// Partial match — finds "Untitled - Notepad", "My Doc - Notepad", etc.
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Notepad' }]);

// Exact match
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Untitled - Notepad', exact: true }]);
```

### Switching back to the desktop root

Pass the sentinel string `'root'` to `driver.switchToWindow()` to reset the session root back to the Windows desktop element. Useful after switching to a specific app window or a titleless system pane (e.g. system tray overflow).

```js
// Switch to some app window
await driver.switchToWindow(someHandle);

// ... do work ...

// Return to full desktop root
await driver.switchToWindow('root');
```

### windows: getWindowElement

Returns the automation element ID of the current root window. No arguments.

### windows: getDeviceTime

Returns the Windows system time as a string.

| Argument | Type | Description |
|---|---|---|
| `format` | string | Optional. The format of the returned string. Defaults to `yyyy-MM-ddTHH:mm:sszzz` (ISO 8601). By default it is a [.NET custom date and time format string](https://learn.microsoft.com/en-us/dotnet/standard/base-types/custom-date-and-time-format-strings), e.g. `yyyy-MM-dd` (not moment.js `YYYY-MM-DD`). |
| `formatSyntax` | string | Optional. `dotnet` (default) or `moment`. With `moment`, `format` is in [moment.js notation](https://momentjs.com/docs/#/displaying/format/), as in the other Appium drivers, e.g. `YYYY-MM-DD`. Supported tokens: `YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm m ss s SSS SS S A Z ZZ` (`ZZ` is written with a colon, like `Z`); text in `[brackets]` and other characters are kept as is. |

### windows: getMonitors

Returns an array of monitor descriptors. No arguments.

| Property | Type | Description |
| --- | --- | --- |
| `index` | number | Zero-based monitor index |
| `deviceName` | string | Device name, e.g. `\\.\DISPLAY1` |
| `primary` | boolean | `true` for the primary display |
| `bounds` | object | `{ x, y, width, height }` in virtual screen coords |
| `workingArea` | object | Usable area excluding taskbars |

```js
const monitors = await driver.executeScript('windows: getMonitors', [{}]);
const secondary = monitors.find(m => !m.primary);
if (secondary) {
  await driver.setWindowRect(
    secondary.bounds.x, secondary.bounds.y, null, null
  );
}
```

### windows: getDpiScale

Returns the primary display's DPI scaling factor as a number, e.g. `1.5`
for 150% scaling. No arguments.

### windows: getNativeChildren

Walks the raw MSAA (`IAccessible`) tree of an element, for legacy
controls that expose no UIA children (custom-drawn Win32 controls,
ActiveX grids).

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `elementId` | string | yes | The element whose MSAA children are walked |

Returns `{ supported: true, node }`, where each node has `name`, `role`,
`value`, `description`, `state`, `defaultAction`, `rect`, `childCount`,
`truncated` and `children`, or `{ supported: false, reason }` when the
element has no `IAccessible` implementation. If it is unsupported or the
root has no children, fall back to image- or coordinate-based
interaction.

### windows: getPerfMetrics

Returns the session's performance counters as
`{ enabled, metrics: { totalCalls, totalMs, byLabel: { <label>: { count, totalMs } } } }`.
Counters are only collected when the session was created with
`appium:perfMetrics: true`; otherwise `enabled` is `false` and `metrics`
is empty. No arguments. See [Performance](../contributing/performance.md).

### windows: resetPerfMetrics

Zeroes the session's performance counters, so the counts that follow
belong to the next operation alone. No arguments.

## Clipboard

### windows: getClipboard

Returns base64-encoded clipboard content.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `contentType` | `'plaintext'` / `'image'` | no | Default: `'plaintext'` |

### windows: setClipboard

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `b64Content` | string | yes | Base64-encoded content |
| `contentType` | `'plaintext'` / `'image'` | no | Default: `'plaintext'` |

## File System

### windows: deleteFile

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | string | yes | Absolute path to the file |

### windows: deleteFolder

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | string | yes | Absolute path to the folder |
| `recursive` | boolean | no | Delete recursively. Default: `true` |

## Screen Recording

Screen recording uses the bundled ffmpeg binary. It is not available
if the driver was installed without its npm dependencies.

### windows: startRecordingScreen

Begins recording the screen.

### windows: stopRecordingScreen

Stops recording and returns a base64-encoded video string.

```js
await driver.executeScript('windows: startRecordingScreen', [{}]);
// ... run your test ...
const video = await driver.executeScript(
  'windows: stopRecordingScreen', [{}]
);
// video is a base64-encoded mp4
```

## PowerShell Execution

### powerShell

Executes a PowerShell script and returns its trimmed stdout. Anything
written to stderr fails the command with that text.

The script name is `powerShell` (there is no `windows:` prefix). The
argument is the script as a string, or an object with a `script` (or
`command`) property.

Each call starts a new `powershell.exe` process, so variables, functions
and the current location do not carry over from one call to the next.
Put everything a step needs into one script. The process starts in
`appium:appWorkingDir` when that capability is set. With
`appium:isolatedScriptExecution` set to `true`, the process is started
without loading the user profile.

```js
const output = await driver.executeScript('powerShell', [
  'Get-Process notepad -ErrorAction SilentlyContinue',
]);

// Object form
const year = await driver.executeScript('powerShell', [
  { script: 'Get-Date -Format yyyy' },
]);
```

## Cache Requests

### windows: cacheRequest

Activates a UIA cache request, for example to expose RawView elements in
the element tree. All arguments are optional, but at least one must be
set.

| Argument | Type | Required | Description |
| --- | --- | --- | --- |
| `treeFilter` | string | no | UIA condition, e.g. `RawView` |
| `treeScope` | string | no | `Element`, `Children`, or `Subtree` |
| `automationElementMode` | string | no | `None` or `Full`. Default: `Full` |

```js
await driver.executeScript('windows: cacheRequest', [{ treeFilter: 'RawView' }]);
```
