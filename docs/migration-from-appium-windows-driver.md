# Migrating from `appium-windows-driver`

Client-side migration guide for test suites written against the deprecated
[`appium-windows-driver`](https://github.com/appium/appium-windows-driver)
(a proxy to Microsoft's WinAppDriver) that now run on Appium WinCore Driver.
Code samples use the [Appium .NET client](https://github.com/appium/dotnet-client)
(`Appium.WebDriver`); the same changes apply to any WebDriver client, since
they are about capabilities, locators and `executeScript` arguments.

For most suites the migration is a handful of one-line changes. Start with
the [checklist](#migration-checklist).

## What changes under the hood

| | `appium-windows-driver` | Appium WinCore Driver |
| --- | --- | --- |
| Automation backend | WinAppDriver (`WinAppDriver.exe`, separate install, unmaintained) | Built-in .NET UI Automation server, spawned per session |
| Appium server | Appium 3 (driver 5.x); not compatible with Appium 4 | Appium 4 (driver 4.x); Appium 3 needs driver 3.x |
| Extra host setup | Developer Mode, WinAppDriver install (`install-wad`), `APPIUM_WAD_PATH` | None |
| `automationName` | `Windows` | `Wincore` |

Everything WinAppDriver-specific (Developer Mode, `install-wad`,
`APPIUM_WAD_PATH`, `systemPort`, `wadUrl`) is no longer needed. The wire
protocol is plain W3C WebDriver, so your client library does not change.

## Migration checklist

1. Install the new driver: `appium driver install --source=npm appium-wincore-driver`
   (Appium 4). Uninstall the old one if it is still present.
2. Set `AutomationName` to `Wincore`.
3. Remove capabilities that no longer exist ([table](#capabilities)).
4. Replace `remotePath` with `path` in `windows: deleteFile` /
   `windows: deleteFolder`, and `fps` with `videoFps` in
   `windows: startRecordingScreen` ([details](#extension-commands)).
5. Write `windows: <command>` **with a space** (`windows:closeApp` is not
   recognised; see [.NET client notes](#net-client-notes)).
6. Re-run your suite and look at XPath-heavy tests for speed
   ([locators](#locators)).

## Session setup

### Before (`appium-windows-driver`)

```csharp
using OpenQA.Selenium.Appium;
using OpenQA.Selenium.Appium.Windows;

var options = new AppiumOptions
{
    PlatformName = "Windows",
    AutomationName = "Windows",
    App = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
};
options.AddAdditionalAppiumOption("ms:waitForAppLaunch", 5);

var driver = new WindowsDriver(new Uri("http://127.0.0.1:4723/"), options);
```

### After (WinCore)

```csharp
using OpenQA.Selenium.Appium;
using OpenQA.Selenium.Appium.Windows;

var options = new AppiumOptions
{
    PlatformName = "Windows",
    AutomationName = "Wincore",   // was "Windows"
    App = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
};
options.AddAdditionalAppiumOption("ms:waitForAppLaunch", 5);

var driver = new WindowsDriver(new Uri("http://127.0.0.1:4723/"), options);
```

`app` accepts the same values as before: a UWP AUMID, an `.exe` path, or
`Root` for the desktop.

### Capabilities

| Capability | Status | Notes |
| --- | --- | --- |
| `platformName` | Same | `Windows` |
| `appium:automationName` | **Changed** | `Wincore` |
| `appium:app` | Same | AUMID, path, or `Root` |
| `appium:appTopLevelWindow` | Same | Hex/decimal window handle. Do not combine with `app` |
| `appium:appArguments` | Same | |
| `appium:appWorkingDir` | Same | Also the working directory of `powerShell` scripts |
| `appium:ms:waitForAppLaunch` | Same, wider range | Seconds (<=120) or milliseconds (>120). The old limit was 50 s |
| `appium:ms:forcequit` | Same | Force-kill the app at session end |
| `appium:ms:experimental-webdriver` | Same | |
| `appium:prerun` / `appium:postrun` | Same | `{ script }` or `{ command }` PowerShell. Run before the session starts / after it ends |
| `appium:newCommandTimeout` | Same | Handled by Appium core |
| `appium:systemPort` | **Ignored** | There is no HTTP listener; the driver talks to its server over stdin/stdout. A log line notes the capability is ignored |
| `appium:createSessionTimeout` | **Removed** | A WinAppDriver start-up workaround |
| `appium:wadUrl` | **Removed** | There is no WinAppDriver to point at |
| `appium:shouldCloseApp` | New | Close the window at session end. Default `true` |
| `appium:isolatedScriptExecution` | New | Skip the user profile for PowerShell scripts |
| `appium:smoothPointerMove`, `delayBeforeClick`, `delayAfterClick` | New | Mouse easing and click delays |
| `appium:webviewEnabled` and related | New | WebView2 / Chrome / Edge via CDP |
| `appium:perfMetrics` | New | Per-session performance counters |

See the [README](../README.md#capabilities) for the full list.

## Locators

The supported strategies are a superset of the old driver's. Existing
locators keep working; there are two differences worth checking.

| Strategy | .NET | Notes |
| --- | --- | --- |
| `accessibility id` | `MobileBy.AccessibilityId("num1Button")` | `AutomationId` |
| `name` | `MobileBy.Name("One")` | `Name` |
| `class name` | `MobileBy.ClassName("TextBlock")` | `ClassName` |
| `id` | `MobileBy.Id("42.1234.5")` | Decimal `RuntimeId` |
| `tag name` | `MobileBy.TagName("Button")` | See below |
| `xpath` | `By.XPath("//Button[@Name='OK']")` | XPath 1.0, as before |
| `-windows uiautomation` | `MobileBy.WindowsAutomation("new PropertyCondition(AutomationElement.NameProperty, 'OK')")` | Parsed natively, not executed |
| `css selector` | `By.CssSelector("Button[name='OK']")` | New. Compiled to a native condition |

Prefer the `MobileBy.*` factories over `By.Id` / `By.Name` / `By.ClassName`.
The .NET client sends the Selenium ones as CSS selectors (`#x`, `*[name ="x"]`,
`.x`), which WinCore compiles to `AutomationId`, `Name` and `ClassName`
conditions. Note that `By.Id` therefore matches the **AutomationId**, while
`MobileBy.Id` matches the **RuntimeId**.

**`tag name`.** `Button` (PascalCase) now matches the language-neutral
`ControlType`; lowercase `button` matches the OS-localized control type, as
the old driver's tag name did. Switch to PascalCase to make a suite
independent of the Windows display language.

**XPath speed.** The old driver relied on WinAppDriver's own tree walk;
WinCore evaluates XPath against an XML snapshot of the whole search-root
subtree, so an absolute `//...` query on a very large window can be slow,
while `id`, `accessibility id`, `name`, `class name` and `-windows uiautomation`
are native UIA searches. Anchor with a native locator and run XPath relative
to it:

```csharp
var grid = driver.FindElement(MobileBy.AccessibilityId("ServersGrid"));
var row = grid.FindElement(By.XPath(".//DataItem[starts-with(@LegacyValue, 'db-01;')]"));
```

XPath node tests are case-sensitive PascalCase control types (`//Button`;
`//button` matches nothing). Details and timings: [API.md](../API.md#locator-performance).

New attributes on every element: `Value`, `LegacyValue`, `LegacyName`,
`LegacyDescription`, `LegacyRole`, `LegacyState`. They make content of MSAA
grids (DevExpress, DataGridView, VB6, Delphi) locatable without extra setup.
See [API.md](../API.md#standard-accessibility-values).

## Extension commands

Call them through `ExecuteScript` exactly as before. Pass a single
dictionary (or an element for commands that take only `elementId`):

```csharp
// Element-only commands: pass the element
driver.ExecuteScript("windows: invoke", driver.FindElement(MobileBy.AccessibilityId("num5Button")));

// Everything else: one dictionary of named arguments
var icon = driver.FindElement(MobileBy.Name("Notepad"));
driver.ExecuteScript("windows: click", new Dictionary<string, object>
{
    ["elementId"] = icon.Id,
    ["times"] = 2,
    ["interClickDelayMs"] = 100,
});
```

### Unchanged

`windows: click`, `scroll`, `hover`, `keys`, `getClipboard`, `setClipboard`,
`launchApp`, `closeApp`, `stopRecordingScreen` and `powerShell` keep their
names and arguments.

### Changed arguments

| Command | Old | New |
| --- | --- | --- |
| `windows: deleteFile` | `remotePath` | `path` |
| `windows: deleteFolder` | `remotePath` | `path` |
| `windows: startRecordingScreen` | `fps` | `videoFps` (also new: `outputPath`, `audioInput`) |
| `windows: clickAndDrag` | `durationMs` defaulted to 5000 | defaults to 500; pass `durationMs` to keep the old pace |

```csharp
// Before
driver.ExecuteScript("windows: deleteFile", new Dictionary<string, object> { ["remotePath"] = @"C:\temp\a.txt" });
// After
driver.ExecuteScript("windows: deleteFile", new Dictionary<string, object> { ["path"] = @"C:\temp\a.txt" });
```

`deleteFile` / `deleteFolder` still need the `modify_fs` insecure feature
(`appium --allow-insecure=modify_fs`).

### PowerShell

```csharp
var output = driver.ExecuteScript("powerShell", new Dictionary<string, object>
{
    ["script"] = "Get-Process notepad -ErrorAction SilentlyContinue",
});
```

Same call as before (`script` or `command`; a plain string also works).
Differences:

- WinCore does **not** gate `powerShell` behind the `power_shell` insecure
  feature. Anyone who can reach the Appium server can run PowerShell, so
  keep the server off untrusted networks.
- Each call starts a fresh `powershell.exe`; variables do not carry over
  between calls.
- Anything written to stderr fails the command with that text.

### New commands worth adopting

| Command | Use |
| --- | --- |
| `windows: setValue`, `getValue` | Set/read a value through `ValuePattern` |
| `windows: selectFromCombobox` | Open a combo/list/tree, pick an entry by exact text, close it |
| `windows: select`, `expand`, `collapse`, `toggle`, `scrollIntoView`, `setFocus` | UIA patterns, with success verification on MSAA controls |
| `windows: getWindows`, `switchToWindowByTitle` | Find windows with no title or by partial title |
| `windows: cacheRequest` | Expose RawView elements |
| `windows: getMonitors`, `getDpiScale`, `getDeviceTime` | Environment info |
| `windows: getNativeChildren` | Walk the MSAA tree for legacy controls |

Full reference: [API.md](../API.md#extension-commands).

## Windows, input and the rest of the WebDriver surface

- **Window handles.** `driver.WindowHandles` lists only windows with a
  title. `windows: getWindows` returns every visible top-level
  window as `{ handle, title, className }`; pass `handle` to
  `driver.SwitchTo().Window(...)`. `SwitchTo().Window("root")` returns to
  the desktop.
- **Actions.** Selenium's `ActionBuilder` / `PerformActions` work against
  mouse, keyboard and wheel sources. Touch and pen pointers are not
  supported (the Sticky Notes pen sample from the old test suite will not
  port as is). See [API.md](../API.md#w3c-actions).
- **Element click vs. invoke.** `element.Click()` simulates a mouse click.
  For controls that ignore pointer events, `windows: invoke` calls the UIA
  `InvokePattern` directly (the [Calculator sample](../examples/C%23/CalculatorTest)
  does this).
- **Typing.** `element.SendKeys(...)` focuses the element and types
  independently of the keyboard layout.

## .NET client notes

- **Package.** `Appium.WebDriver` (current major: 9.x). The bundled
  [Calculator sample](../examples/C%23/CalculatorTest) uses 7.2.0. Both work;
  use whichever your suite is already on.
- **Driver class.** `WindowsDriver` and `AppiumOptions` are unchanged. The
  class only sets `platformName`; `AutomationName` is yours to set.
- **`windows:` needs a space.** WinCore matches execute-method names
  exactly. `WindowsDriver.CloseApp()` and `LaunchApp()` send the name
  without a space (`windows:closeApp`), which the driver does not map
  (confirmed by reading the driver's dispatch code, not by running a Windows
  session). Call the commands yourself instead:

  ```csharp
  driver.ExecuteScript("windows: closeApp");
  driver.ExecuteScript("windows: launchApp");
  ```

- **Context switching.** `WindowsDriver.Context` is hard-wired to
  `NATIVE_APP` and its setter throws, so the typed API cannot enter a
  WebView or IE context. Plain UIA suites are unaffected.
- **Not applicable on Windows.** `HideKeyboard`, `PressKeyCode` and other
  mobile-only members were not supported by the old driver either.

## Putting it together

```csharp
using OpenQA.Selenium;
using OpenQA.Selenium.Appium;
using OpenQA.Selenium.Appium.Windows;

var options = new AppiumOptions
{
    PlatformName = "Windows",
    AutomationName = "Wincore",
    App = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
};

var driver = new WindowsDriver(new Uri("http://127.0.0.1:4723/"), options);
try
{
    driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(1.5);

    foreach (var id in new[] { "num5Button", "plusButton", "num3Button", "equalButton" })
    {
        driver.ExecuteScript("windows: invoke", driver.FindElement(MobileBy.AccessibilityId(id)));
    }

    Console.WriteLine(driver.FindElement(MobileBy.AccessibilityId("CalculatorResults")).Text);
}
finally
{
    driver.Quit();
}
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Session creation fails with an automation-name error | `AutomationName` is still `Windows` |
| `Unsupported execute method 'windows:closeApp'` | Missing space; see [.NET client notes](#net-client-notes) |
| `'path' must be provided.` | `deleteFile` / `deleteFolder` still pass `remotePath` |
| `windows: deleteFile` rejected as insecure | Start Appium with `--allow-insecure=modify_fs` |
| XPath lookups much slower than before | Anchor with a native locator, then query relative to it |
| `//button` finds nothing | Node tests are case-sensitive: `//Button` |
| `invalid element state` from `windows: select` / `expand` / `collapse` | The MSAA control did not change state; the old driver reported success regardless |
