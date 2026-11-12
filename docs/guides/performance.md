---
title: Performance Metrics
---

The WinCore driver can measure the time spent in some of its internal calls, which helps to
understand why a command is slow. For example, it can show how much of a page source request or an
[XPath](../reference/locator-strategies.md#xpath) lookup was spent reading elements from the UI
Automation tree.

## Enabling the Metrics

Metrics are collected per session, and only when the session is created with the
[`appium:perfMetrics`](../reference/capabilities.md#perfmetrics) capability:

```json
{
  "platformName": "Windows",
  "appium:automationName": "Wincore",
  "appium:app": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
  "appium:perfMetrics": true
}
```

Collecting the metrics adds almost no overhead.

## Reading and Resetting the Metrics

Two execute methods give access to the counters:

* [`windows: getPerfMetrics`](../reference/execute-methods.md#windows-getperfmetrics) returns the
  counters collected so far
* [`windows: resetPerfMetrics`](../reference/execute-methods.md#windows-resetperfmetrics) sets
  them back to zero, so that the next reading only covers the operations that follow

```js
await driver.executeScript('windows: resetPerfMetrics', []);
await driver.getPageSource();
const { enabled, metrics } = await driver.executeScript('windows: getPerfMetrics', []);
```

The result has the following shape:

```json
{
  "enabled": true,
  "metrics": {
    "totalCalls": 3036,
    "totalMs": 4612.4,
    "byLabel": {
      "uia.pageSource.node": { "count": 3036, "totalMs": 4612.4 }
    }
  }
}
```

If the session was created without `appium:perfMetrics`, `enabled` is `false` and `metrics` is
empty.

## Counter Labels

| Label | `count` | `totalMs` |
| --- | --- | --- |
| `uia.pageSource.node` | Elements read for the page source | Time spent reading them |
| `uia.xpathModel.node` | Elements read for an XPath lookup | Time spent reading them |

Each element read costs about 1.5 ms on WPF applications, and more on WinForms and MSAA-based
controls. If these counters dominate a slow test, see
[Absolute vs. Relative Lookup](../reference/locator-strategies.md#absolute-vs-relative-lookup) for
ways to read fewer elements.
