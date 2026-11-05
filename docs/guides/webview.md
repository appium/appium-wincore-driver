# WebView and CDP

The driver proxies commands through Chromedriver or EdgeDriver to
automate WebView2 controls, Electron apps, or standalone browsers.

## Required capabilities

| Capability | Description |
| --- | --- |
| `appium:webviewEnabled: true` | Enable CDP support |
| `appium:webviewDevtoolsPort` | CDP port (auto for WebView2) |
| `appium:chromedriverExecutablePath` | Skip Chromedriver download |
| `appium:edgedriverExecutablePath` | Skip EdgeDriver download |

The driver auto-downloads the matching Chromedriver or EdgeDriver
version. Internet access is required unless you provide a local binary.

## Context switching

```js
// List all contexts; pass waitForWebviewMs to wait for page load
const contexts = await driver.execute('mobile: getContexts', [{}]);
// [
//   { id: 'NATIVE_APP' },
//   { id: 'WEBVIEW_...', title: 'My Page', url: '...', type: 'page' }
// ]

const webId = contexts.find(c => c.id.startsWith('WEBVIEW_')).id;

// Switch to web context — all WebDriver commands proxy to Chromedriver
await driver.switchContext(webId);
const title = await driver.getTitle();

// Back to native UIA
await driver.switchContext('NATIVE_APP');
```

`windows:` extension commands always target the native UIA layer
regardless of the active context.

## Launching Chrome or Edge for testing

```js
const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app':
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'appium:appArguments':
      '--remote-debugging-port=9222 --user-data-dir=C:\\Temp\\cr-test',
    'appium:webviewEnabled': true,
    'appium:webviewDevtoolsPort': 9222,
  },
});
```

Use `--user-data-dir` to isolate the session from any running Chrome
instance.

## WebView2 apps

For apps that embed a WebView2 control, omit `appArguments` and
`webviewDevtoolsPort` — the driver injects the debug port automatically.

```js
capabilities: {
  platformName: 'Windows',
  'appium:automationName': 'Wincore',
  'appium:app': 'C:\\Path\\To\\YourApp.exe',
  'appium:webviewEnabled': true,
}
```
