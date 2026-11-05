# W3C Actions

The driver implements the W3C WebDriver Actions API. Supported input
source types: `pointer` (mouse only; touch/pen not supported), `key`,
`wheel`, and `none`.

## Tick ordering

Actions are processed tick by tick. All actions at the same tick index
across input sources run simultaneously (`Promise.all`). Ticks advance
sequentially. Use `pause` entries to align sources.

```js
// Tick 1: keyDown and pointerDown fire at the same time
await driver.performActions([
  {
    type: 'key',
    id: 'keyboard',
    actions: [
      { type: 'pause' },                     // tick 0
      { type: 'keyDown', value: '\uE009' },  // tick 1 — simultaneous
      { type: 'keyUp', value: '\uE009' },    // tick 2
    ],
  },
  {
    type: 'pointer',
    id: 'mouse',
    parameters: { pointerType: 'mouse' },
    actions: [
      { type: 'pointerMove', duration: 0, x: 100, y: 200 }, // tick 0
      { type: 'pointerDown', button: 0 },                    // tick 1
      { type: 'pointerUp', button: 0 },                      // tick 2
    ],
  },
]);
await driver.releaseActions();
```

Always call `driver.releaseActions()` after `performActions()` to
release any held keys or mouse buttons.

## Supported action types

### Pointer actions

`type: 'pointer'`, `pointerType: 'mouse'`

| Type | Description |
| --- | --- |
| `pointerMove` | Move to `{ x, y }` or `{ origin: element }` |
| `pointerDown` | Press button (`button: 0` = left) |
| `pointerUp` | Release button |
| `pause` | Wait for `duration` ms |

### Key actions

`type: 'key'`

| Type | Description |
| --- | --- |
| `keyDown` | Press a key (W3C key value or Unicode char) |
| `keyUp` | Release a key |
| `pause` | Wait for `duration` ms |

### Wheel actions

`type: 'wheel'`

| Type | Description |
| --- | --- |
| `scroll` | Scroll with `deltaX`/`deltaY` |
