---
title: Capabilities
---

This page lists various capabilities used and implemented by the WinCore driver. To learn more
about capabilities, refer to the [Appium documentation](https://appium.io/docs/en/latest/guides/caps/).

For other capabilities recognized by the Appium server, see
[their Appium docs reference page](https://appium.io/docs/en/latest/reference/session/caps/).

## Standard

Refer to [the W3C WebDriver documentation](https://w3c.github.io/webdriver/#capabilities)
for more information about these capabilities.

### platformName

| Name | Type | Default |
| -- | -- | -- |
| `platformName` | `string` | Not specified |

Must be set to `Windows` (case-insensitive).

## General

### automationName

| Name | Type | Default |
| -- | -- | -- |
| `appium:automationName` | `string` | Not specified |

Specifies the Appium driver to use. Must be set to `Wincore` (case-insensitive).

### logFile

| Name | Type | Default |
| -- | -- | -- |
| `appium:logFile` | `string` or `boolean` | Not specified |

Mirrors the driver's session log to a file, in addition to the Appium server log. Accepts:

* `true`: writes to a timestamped `session-<timestamp>.log` file in
  `%LOCALAPPDATA%\appium-wincore-driver\`
* a path ending in `\` or `/`: writes a timestamped file into that folder
* any other path: writes to exactly that file

### perfMetrics

| Name | Type | Default |
| -- | -- | -- |
| `appium:perfMetrics` | `boolean` | `false` |

Enables per-session performance counters for the driver's internal calls. Read them with
[`windows: getPerfMetrics`](./execute-methods.md#windows-getperfmetrics) and reset them with
[`windows: resetPerfMetrics`](./execute-methods.md#windows-resetperfmetrics). See the
[Performance Metrics guide](../guides/performance.md).

## App

### app

| Name | Type | Default |
| -- | -- | -- |
| `appium:app` | `string` | Not specified |

The application to automate. Accepts one of:

* a path to an executable, for example `C:\Windows\System32\notepad.exe`
* a UWP application user model ID, for example `Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`
* `Root`, to attach to the whole Windows desktop instead of a single application

Environment variables in `%NAME%` form are expanded in executable paths.

Cannot be combined with [`appium:appTopLevelWindow`](#apptoplevelwindow). If neither is provided,
the session starts without a root window, and a window must be selected later, for example with
[`windows: switchToWindowByTitle`](./execute-methods.md#windows-switchtowindowbytitle).

### appTopLevelWindow

| Name | Type | Default |
| -- | -- | -- |
| `appium:appTopLevelWindow` | `string` | Not specified |

The handle of an already open top-level window to attach to, as a hexadecimal (`0x001A0B2C`) or
decimal string. Numbers are accepted too and converted to a string. Use this instead of
[`appium:app`](#app) to automate an application that is already running.

### appArguments

| Name | Type | Default |
| -- | -- | -- |
| `appium:appArguments` | `string` | Not specified |

Command line arguments passed to the application launched by [`appium:app`](#app).

### appWorkingDir

| Name | Type | Default |
| -- | -- | -- |
| `appium:appWorkingDir` | `string` | Not specified |

Working directory for the application launched by [`appium:app`](#app). Environment variables in
`%NAME%` form are expanded.

### ms:waitForAppLaunch

| Name | Type | Default |
| -- | -- | -- |
| `appium:ms:waitForAppLaunch` | `number` | Not specified |

How long to wait for the application window to appear after launch. Values up to `120` are read as
seconds, larger values as milliseconds.

The same wait applies when the first window to appear is a splash screen: the driver waits for it
to give way to the main window. If this capability is not set, the splash screen wait is 5 seconds.

### shouldCloseApp

| Name | Type | Default |
| -- | -- | -- |
| `appium:shouldCloseApp` | `boolean` | `true` |

Whether to close the application window when the session ends. Has no effect in `Root` sessions.

### ms:forcequit

| Name | Type | Default |
| -- | -- | -- |
| `appium:ms:forcequit` | `boolean` | `false` |

When the application is closed at the end of the session (see
[`appium:shouldCloseApp`](#shouldcloseapp)), kill its process instead of closing its window.

## Scripts

### prerun

| Name | Type | Default |
| -- | -- | -- |
| `appium:prerun` | `object` | Not specified |

A PowerShell script to run before the application is started. Provide either `{"script": "..."}`
or `{"command": "..."}`.

### postrun

| Name | Type | Default |
| -- | -- | -- |
| `appium:postrun` | `object` | Not specified |

A PowerShell script to run after the session ends. Provide either `{"script": "..."}` or
`{"command": "..."}`.

### isolatedScriptExecution

| Name | Type | Default |
| -- | -- | -- |
| `appium:isolatedScriptExecution` | `boolean` | `false` |

Runs PowerShell scripts ([`windows: powerShell`](./execute-methods.md#powershell),
[`appium:prerun`](#prerun) and [`appium:postrun`](#postrun)) without loading the user profile.

## Input

### smoothPointerMove

| Name | Type | Default |
| -- | -- | -- |
| `appium:smoothPointerMove` | `string` | Not specified |

Easing curve for mouse pointer moves. Accepts `linear`, `ease`, `ease-in`, `ease-out`,
`ease-in-out`, or a `cubic-bezier(x1,y1,x2,y2)` expression. If not set, the pointer jumps directly
to its target.

### delayBeforeClick

| Name | Type | Default |
| -- | -- | -- |
| `appium:delayBeforeClick` | `number` | `0` |

Duration of the pointer move to an element before clicking it, in milliseconds. Combine with
[`appium:smoothPointerMove`](#smoothpointermove) for a visible, human-like movement.

### delayAfterClick

| Name | Type | Default |
| -- | -- | -- |
| `appium:delayAfterClick` | `number` | `50` (`100` for menu items) |

Time to wait after each click, in milliseconds.

## Webview

See the [Hybrid Mode guide](../guides/webview.md) for more details about these capabilities.

### webviewEnabled

| Name | Type | Default |
| -- | -- | -- |
| `appium:webviewEnabled` | `boolean` | `false` |

Enables automation of WebView2, Chrome and Edge content over the Chrome DevTools Protocol.

### webviewDevtoolsPort

| Name | Type | Default |
| -- | -- | -- |
| `appium:webviewDevtoolsPort` | `number` | Selected automatically |

The remote debugging port to connect to. For WebView2 applications launched by the driver, the
port is selected and injected automatically.

### chromedriverExecutablePath

| Name | Type | Default |
| -- | -- | -- |
| `appium:chromedriverExecutablePath` | `string` | Not specified |

Path to a local Chromedriver binary to use instead of downloading one.

### edgedriverExecutablePath

| Name | Type | Default |
| -- | -- | -- |
| `appium:edgedriverExecutablePath` | `string` | Not specified |

Path to a local Microsoft Edge WebDriver (`msedgedriver`) binary to use instead of downloading one.

### chromedriverCdnUrl

| Name | Type | Default |
| -- | -- | -- |
| `appium:chromedriverCdnUrl` | `string` | Not specified |

Custom CDN URL to download Chromedriver from.

### edgedriverCdnUrl

| Name | Type | Default |
| -- | -- | -- |
| `appium:edgedriverCdnUrl` | `string` | Not specified |

Custom CDN URL to download Microsoft Edge WebDriver from.

## Screen Recording

### ffmpegExecutablePath

| Name | Type | Default |
| -- | -- | -- |
| `appium:ffmpegExecutablePath` | `string` | Not specified |

Path to a local FFmpeg binary, used by screen recording.

## Compatibility

The following capabilities are accepted for compatibility with existing Windows test suites, but
have no effect:

* `appium:ms:experimental-webdriver`
* `appium:deviceName`
* `appium:systemPort` (the driver does not use a network port to talk to `WincoreServer.exe`)
