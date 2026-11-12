---
title: WebView
---

The WinCore driver supports automation of hybrid apps that use Chromium-based web views, such as
WebView2 or Electron apps, as well as the Chrome and Edge browsers. This enables actions such as
retrieving the web-specific page source, as well as finding and interacting with elements located
inside the web view.

!!! warning

    Web content based on other engines is not supported through this mode. Internet Explorer 11 is
    supported through a separate bridge, described in the [Internet Explorer guide](./internet-explorer.md).
    Other web views are only available through the native UI Automation tree.

## Enabling Web Views

Access to web views is not available by default, and must be explicitly enabled by setting the
[`appium:webviewEnabled`](../reference/capabilities.md#webviewenabled) capability to `true`.

The driver connects to the web view through its Chrome DevTools Protocol (CDP) remote debugging
port. How this port is set depends on the application:

* **WebView2 apps launched by the driver**: no additional configuration is needed. The driver
  selects a free port and passes it to the app through the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`
  environment variable.

    ```json
    {
      "platformName": "Windows",
      "appium:automationName": "Wincore",
      "appium:app": "C:\\Path\\To\\YourApp.exe",
      "appium:webviewEnabled": true
    }
    ```

* **Chrome or Edge launched by the driver**: the browser must be started with a debugging port and
  a dedicated profile, using [`appium:appArguments`](../reference/capabilities.md#apparguments), and
  the same port must be provided in [`appium:webviewDevtoolsPort`](../reference/capabilities.md#webviewdevtoolsport).
  The dedicated profile (`--user-data-dir`) isolates the session from any running browser instance.

    ```json
    {
      "platformName": "Windows",
      "appium:automationName": "Wincore",
      "appium:app": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "appium:appArguments": "--remote-debugging-port=9222 --user-data-dir=C:\\Temp\\cr-test",
      "appium:webviewEnabled": true,
      "appium:webviewDevtoolsPort": 9222
    }
    ```

* **Apps that are already running**, attached with [`appium:appTopLevelWindow`](../reference/capabilities.md#apptoplevelwindow)
  or reached from a `Root` session: the app must already expose a debugging port, and that port
  must be provided in [`appium:webviewDevtoolsPort`](../reference/capabilities.md#webviewdevtoolsport).

The availability of a particular web view can be verified with the
[Chrome Remote Debugger](https://developer.chrome.com/docs/devtools/remote-debugging/), or by
opening `http://localhost:<port>/json/list` in a browser.

## Contexts

Web-specific information is not directly integrated into the default page source. Instead, the
driver makes use of Appium's [Context Management API](https://appium.io/docs/en/latest/guides/context/),
where each available web page is separated into its own context. As such, in order to interact with
any web view, it is necessary to first switch to its specific context using the context API.

A WinCore driver session starts in the native context (named `NATIVE_APP`). Each page exposed by the
web view's debugging port is available as an additional `WEBVIEW_<id>` context. To retrieve detailed
information about these pages, the driver also provides the `mobile: getContexts` execute method,
which accepts an optional `waitForWebviewMs` argument to wait for the web view to load:

```js
const contexts = await driver.executeScript('mobile: getContexts', [{waitForWebviewMs: 2000}]);
// [
//   { id: 'NATIVE_APP' },
//   { id: 'WEBVIEW_...', title: 'My Page', url: '...', type: 'page' }
// ]

const webId = contexts.find((c) => c.id.startsWith('WEBVIEW_')).id;

// Switch to the web context
await driver.switchContext(webId);
const title = await driver.getTitle();

// Back to the native context
await driver.switchContext('NATIVE_APP');
```

In practice, when switching the application context from native to web view, the WinCore driver
simply changes the underlying component to which it forwards most API commands:

* Native context: `WincoreServer.exe` (UI Automation)
* Web view context: an instance of [ChromeDriver](https://developer.chrome.com/docs/chromedriver)
  or [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)

Refer to [Technologies Used](../overview.md#technologies-used) for more details.

## Web Context Specifics

Switching from the native context to a web context brings a few benefits and drawbacks alike:

* Web view-specific page source with web elements, similar to the one in Chrome DevTools
* Support for standard W3C WebDriver element locator strategies
* No support for driver-specific native locator strategies
* The `windows:` execute methods are still handled by the native layer, while any other script is
  executed in the web page

Switching to the `NATIVE_APP` context stops the current ChromeDriver or Edge WebDriver instance.

## Managing ChromeDriver and Edge WebDriver

The driver reads the browser name and version from the web view, and uses ChromeDriver for Chrome
and Electron, or Microsoft Edge WebDriver for Edge and WebView2. The version of this driver must
follow the version of the browser engine used by the web view under test.

There are several approaches to obtaining a matching driver version:

### Automatic Download

By default, the driver automatically downloads the version of ChromeDriver or Edge WebDriver that
matches the web view under test. The download is initiated upon switching to the web view context,
and requires internet access from the Appium server host. Downloaded executables are reused by
later sessions.

### Using Capabilities

If the target driver executable already exists on the host machine, it is possible to provide a
path to it using the [`appium:chromedriverExecutablePath`](../reference/capabilities.md#chromedriverexecutablepath)
or [`appium:edgedriverExecutablePath`](../reference/capabilities.md#edgedriverexecutablepath)
capability. In this case, nothing is downloaded, and the executable must match the version of the
web view.

In order to manually download the correct executable, refer to the ChromeDriver
[Version Selection](https://developer.chrome.com/docs/chromedriver/downloads/version-selection)
guide, or to the [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)
download page.

## Troubleshooting

### Downloading

In case of issues when downloading the driver executables, the download location can be changed
with the [`appium:chromedriverCdnUrl`](../reference/capabilities.md#chromedrivercdnurl) and
[`appium:edgedriverCdnUrl`](../reference/capabilities.md#edgedrivercdnurl) capabilities.

It may also be necessary to adjust network proxy and firewall settings for the above to work.
