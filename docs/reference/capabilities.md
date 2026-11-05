# Capabilities

All capabilities use the `appium:` prefix in W3C format
(except `platformName`).

| Capability | Type | Description |
| --- | --- | --- |
| `platformName` | string | **Required.** Must be `Windows` |
| `appium:automationName` | string | **Required.** Must be `Wincore` |
| `appium:app` | string | Exe path, UWP AUMID, or `Root` for the desktop |
| `appium:appTopLevelWindow` | string | Hex/decimal handle to attach to existing window |
| `appium:appArguments` | string | CLI arguments for the launched process |
| `appium:appWorkingDir` | string | Working directory for the process |
| `appium:appEnvironment` | object | Env vars injected for the session lifetime |
| `appium:ms:waitForAppLaunch` | number | Seconds (<=120) or ms (>120) to wait for window, including for a splash screen to give way to the main window (that splash wait defaults to 5 s when unset) |
| `appium:shouldCloseApp` | boolean | Close the window at session end. Default: `true` |
| `appium:prerun` | object | `{ script }` or `{ command }` — PowerShell before start |
| `appium:postrun` | object | `{ script }` or `{ command }` — PowerShell after end |
| `appium:isolatedScriptExecution` | boolean | Run PowerShell scripts (`powerShell`, pre/postrun) without loading the user profile. Default: `false` |
| `appium:smoothPointerMove` | string | CSS easing for mouse (e.g. `ease-in`) |
| `appium:delayBeforeClick` | number | Milliseconds before each click |
| `appium:delayAfterClick` | number | Milliseconds after each click |
| `appium:webviewEnabled` | boolean | Enable WebView2 / Chrome / Edge CDP |
| `appium:webviewDevtoolsPort` | number | CDP port (auto-selected when omitted) |
| `appium:chromedriverExecutablePath` | string | Local Chromedriver binary |
| `appium:edgedriverExecutablePath` | string | Local msedgedriver binary |
| `appium:chromedriverCdnUrl` | string | Custom CDN for Chromedriver downloads |
| `appium:edgedriverCdnUrl` | string | Custom CDN for EdgeDriver downloads |
| `appium:ffmpegExecutablePath` | string | Local ffmpeg binary for screen recording |
| `appium:ms:forcequit` | boolean | Force-kill process on session close |
| `appium:ms:experimental-webdriver` | boolean | Experimental WebDriver features |
| `appium:logFile` | string | Path to write session logs |
| `appium:perfMetrics` | boolean | Enable per-session performance counters, read via `windows: getPerfMetrics` / reset via `windows: resetPerfMetrics`. Default: `false`. See [Performance](../contributing/performance.md). |
