# Examples

## Desktop root: click an icon and switch windows

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app': 'Root', // attach to the Windows desktop shell
  },
});

// Double-click a desktop shortcut by its accessible name
const icon = await driver.$('~Notepad');
await driver.executeScript('windows: click', [{
  elementId: icon.elementId,
  times: 2,
  interClickDelayMs: 100,
}]);

// Give the app time to open, then switch to the new window by handle...
await driver.pause(2000);
const allHandles = await driver.getWindowHandles();
await driver.switchToWindow(allHandles[allHandles.length - 1]);

// ...or switch by title (partial, case-insensitive)
await driver.executeScript('windows: switchToWindowByTitle', [{ title: 'Notepad' }]);

// To include untitled windows (getWindowHandles omits them), use getWindows instead.
// It returns { handle, title, className } for every visible top-level window.
const windows = await driver.executeScript('windows: getWindows', []);
const popup = windows.find(w => w.className === '#32770' && w.title === '');
if (popup) await driver.switchToWindow(popup.handle);

const titleBar = await driver.$('//TitleBar');
console.log(await titleBar.getText());

// Switch back to the desktop root at any time
await driver.switchToWindow('root');

await driver.deleteSession();
```

## Windows Calculator: invoke pattern

`windows: invoke` fires the UIA InvokePattern. Prefer it over `.click()`
for controls that do not respond reliably to pointer events.

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app': 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
  },
});

async function invoke(el) {
  await driver.executeScript('windows: invoke', [el]);
}

// 5 + 3 =
await invoke(await driver.$('~num5Button'));
await invoke(await driver.$('~plusButton'));
await invoke(await driver.$('~num3Button'));
await invoke(await driver.$('~equalButton'));

const display = await driver.$('~CalculatorResults');
console.log(await display.getText()); // "Display is 8"

await driver.deleteSession();
```

## Ctrl+drag via W3C Actions

Actions are processed tick by tick. All actions at the same tick index
across input sources run simultaneously. Ticks advance sequentially.
Use `pause` entries to keep sources aligned when mixing keyboard and
pointer inputs.

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Wincore',
    'appium:app': 'C:\\MyApp\\app.exe',
  },
});

const source = await driver.$('~dragSource');
const target = await driver.$('~dropTarget');

await driver.performActions([
  {
    type: 'key',
    id: 'keyboard',
    actions: [
      { type: 'pause' },                    // tick 0 — wait for mouse move
      { type: 'keyDown', value: '\uE009' }, // tick 1 — Ctrl key (W3C key value)
      { type: 'pause' },                    // tick 2 — hold
      { type: 'pause' },                    // tick 3 — hold during drag
      { type: 'keyUp', value: '\uE009' },   // tick 4 — Ctrl up
    ],
  },
  {
    type: 'pointer',
    id: 'mouse',
    parameters: { pointerType: 'mouse' },
    actions: [
      { type: 'pointerMove', duration: 0, origin: source },   // tick 0
      { type: 'pointerDown', button: 0 },                      // tick 1
      { type: 'pause', duration: 300 },                        // tick 2
      { type: 'pointerMove', duration: 600, origin: target },  // tick 3
      { type: 'pointerUp', button: 0 },                        // tick 4
    ],
  },
]);

await driver.releaseActions();
await driver.deleteSession();
```
