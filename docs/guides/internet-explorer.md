---
title: Internet Explorer
---

`iexplore.exe` exposes content via MSAA/COM, not UIA. The driver
includes a built-in IE DOM Bridge — a 32-bit C# process
(`IEBridge.exe`) that attaches to a running IE 11 window via the
`WM_HTML_GETOBJECT` message, retrieves `IHTMLDocument2` through COM,
and routes element commands over stdio JSON. No WebDriver protocol
proxy and no special capability is needed.

## How it works

1. A standard desktop session starts with UIA active.
2. When `switchToWindow` or `windows: switchToWindowByTitle` targets an
   `IEFrame` window, the driver detects it automatically and spawns
   `IEBridge.exe` for that window handle.
3. Element commands (`findElement`, `click`, `getText`, `setValue`,
   `executeScript`, `switchToFrame`, ...) are sent to the bridge
   process as JSON over stdin/stdout and resolved against the live
   `IHTMLDocument2`.
4. Switching to a non-IE window tears down the IE session; UIA resumes.
5. On `deleteSession`, the bridge process is killed and all state reset.

## Capabilities

No capability is required to automate IE.

## IE configuration (required)

Before automating IE, apply these settings in Internet Options:

- **Security tab** — uncheck "Enable Protected Mode" on every zone
  (Internet, Local Intranet, Trusted Sites, Restricted Sites)
- **Advanced tab** — uncheck "Enable Enhanced Protected Mode"
- **View menu** — set Zoom to exactly 100%

## Mixed-window sessions

IE and non-IE windows can be used in the same session:

```js
// Start a plain desktop session
const driver = await remote({ capabilities: { platformName: 'Windows',
  'appium:automationName': 'Wincore', 'appium:app': 'Root' } });

// Switch to IE — IE Bridge activates automatically
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Internet Explorer' }]);
const h1 = await driver.$('h1');
console.log(await h1.getText()); // IE DOM result

// Switch to Notepad — UIA resumes automatically
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Notepad' }]);
const src = await driver.getPageSource(); // UIA tree

// Switch back to IE — bridge re-activates
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Internet Explorer' }]);
```

## Switching into frames

```js
await driver.switchToFrame(0);           // by 0-based index
await driver.switchToFrame(frameEl);     // by element (find first)
await driver.switchToFrame(null);        // back to default content
await driver.switchToParentFrame();      // also returns to default content
```

Only one level of nesting is tracked — `switchToParentFrame()` always
returns to the top-level document rather than popping a frame stack.

## Command support

| Command | Status | Notes |
|---|---|---|
| `findElement` / `findElements` | ✅ | `css selector`, `id`, `xpath` |
| `getTitle` | ✅ | |
| `getUrl` | ✅ | |
| `getPageSource` | ✅ | |
| `url()` | ✅ | navigate to URL |
| `getWindowHandle` | ✅ | returns HWND hex string |
| `getText(el)` | ✅ | |
| `getAttribute(el, name)` | ✅ | |
| `clear(el)` | ✅ | input / textarea only |
| `setValue(el, value)` | ✅ | input / textarea only |
| `click(el)` | ✅ / ⚠️ | works for buttons, links; broken for checkboxes and radios |
| `isDisplayed(el)` | ✅ | |
| `isEnabled(el)` | ⚠️ | unreliable for elements without an `id` attribute |
| `isSelected(el)` | ❌ | always returns `false` |
| `executeScript(script, args)` | ✅ | runs JS in the IE tab |
| `switchToFrame(id)` | ✅ | by index, element, or `null` for default content |
| `switchToParentFrame()` | ✅ | returns to default content (single-level only) |
| `getElementRect(el)` | ❌ | not implemented |
| `getElementScreenshot(el)` | ❌ | not implemented |
| `windows:` execute methods | ❌ | target the UIA tree, not the HTML DOM |

## Locator strategies in IE windows

When the active window is IE, commands route through IEBridge.
UIA-specific locators are not available — use:

`css selector`, `id`, `xpath`

Supported XPath patterns: `//tag`, `//tag[@attr="val"]`,
`//tag[contains(text(),"...")]`, `//tag[contains(@attr,"...")]`, `//tag[@attr]`

## Limitations

When the active window is IE, the following are not available:
WebView2/CDP, screen recording, clipboard API,
`appium:prerun`/`appium:postrun`, and UIA locator strategies
(`accessibility id`, `-windows uiautomation`, `class name`).

`windows:` execute methods target the UIA tree and are not
available while an IE window is active; use standard WebDriver
equivalents (`element.click()`, `driver.url()`, `executeScript`) instead.

Supported on Windows 10/11 with IE 11 only.

## Walkthrough

The driver includes a built-in IE DOM Bridge — a 32-bit C# process
(`IEBridge.exe`) that attaches to a running IE 11 window via the
`WM_HTML_GETOBJECT` message, retrieves `IHTMLDocument2` through COM, and
routes all element commands over stdio JSON. No WebDriver protocol
proxy is involved.

IE mode activates automatically whenever a session window has the
`IEFrame` window class. This happens when:

- `appium:app` is set to the IE executable and the driver launches it, or
- `appium:appTopLevelWindow` points to an existing IE window handle, or
- `windows: switchToWindow` / `windows: switchToWindowByTitle` targets an IE window.

**Prerequisites:**

- Internet Explorer 11 at `C:\Program Files\Internet Explorer\iexplore.exe`
- Internet Options → Security: Protected Mode **disabled** on all four zones
- Internet Options → Advanced: Enhanced Protected Mode **disabled**
- View → Zoom: set to exactly **100%**

**Supported locator strategies:** `css selector`, `id`, `xpath`

Supported XPath patterns: `//tag`, `//tag[@attr="val"]`,
`//tag[contains(text(),"...")]`, `//tag[contains(@attr,"...")]`, `//tag[@attr]`

**Command support:**

| Command | Status | Notes |
|---|---|---|
| `findElement` / `findElements` | ✅ | css selector, id, xpath |
| `getTitle` | ✅ | |
| `getUrl` | ✅ | |
| `getPageSource` | ✅ | |
| `url()` | ✅ | navigate to URL |
| `getWindowHandle` | ✅ | returns HWND hex string |
| `getText(el)` | ✅ | |
| `getAttribute(el, name)` | ✅ | |
| `clear(el)` | ✅ | input / textarea only |
| `setValue(el, value)` | ✅ | input / textarea only |
| `click(el)` | ✅ / ⚠️ | works for buttons, links; broken for checkboxes and radios |
| `isDisplayed(el)` | ✅ | |
| `isEnabled(el)` | ⚠️ | unreliable for elements without an `id` attribute |
| `isSelected(el)` | ❌ | always returns `false` |
| `executeScript(script, args)` | ✅ | runs JS in the IE tab |
| `switchToFrame(id)` | ✅ | by index, element, or `null` for default content |
| `switchToParentFrame()` | ✅ | returns to default content (single-level only) |
| `getElementRect(el)` | ❌ | not implemented |
| `getElementScreenshot(el)` | ❌ | not implemented |
| `windows:` execute methods | ❌ | target the UIA tree, not the HTML DOM |

### Launch IE and automate it

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app': 'C:\\Program Files\\Internet Explorer\\iexplore.exe',
    'appium:appArguments': 'https://example.com',
    'appium:shouldCloseApp': true,
  },
});

await driver.pause(3000); // wait for IE to load the page
await driver.setTimeout({ implicit: 5000 });

const title = await driver.getTitle();
console.log(title); // "Example Domain"

const h1 = await driver.$('h1');
console.log(await h1.getText());

await driver.deleteSession();
```

### Attach to an already-open IE window

```js
import { remote } from 'webdriverio';

// hwnd is the decimal or hex HWND string of the IEFrame window
const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:appTopLevelWindow': '0x001A0B2C',
    'appium:shouldCloseApp': false,
  },
});

const url = await driver.getUrl();
console.log(url);

await driver.deleteSession();
```

### Switch into an iframe

```js
// By 0-based index
await driver.switchToFrame(0);

// By element
const frameEl = await driver.$('iframe#content');
await driver.switchToFrame(frameEl);

// Element finds are now scoped to the frame's document
const h1 = await driver.$('h1');
console.log(await h1.getText());

// Back to the top-level document
await driver.switchToFrame(null);
```

Only one level of nesting is tracked — switching into a frame while
already inside one replaces the current frame context rather than
stacking. `switchToParentFrame()` always returns to default content.

### Switch between IE and UIA within the same session

Start a `Root` session and navigate between windows freely. The driver
switches between IE Bridge mode and UIA mode automatically based on whether
the target window is an `IEFrame`.

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app': 'Root',
  },
});

// Focus the IE window — IE Bridge activates automatically
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Internet Explorer' }]);

const h1 = await driver.$('h1');
console.log(await h1.getText());

// Switch to a non-IE window — UIA resumes automatically
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Notepad' }]);

await driver.deleteSession();
```
