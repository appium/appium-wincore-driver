---
hide:
  - navigation

title: Getting Started
---

## System Requirements

There are three primary requirements to use the WinCore driver:

* Windows host machine (see [Target Platforms](../overview.md#target-platforms))
* [Node.js](https://nodejs.org) `^22.22.2`, `^24.15.0` or `>=26.0.0`
* Appium

The application under test must run on the same machine as the Appium server, in an interactive
desktop session: UI Automation and input synthesis need a live, unlocked desktop.

### Appium Server

Make sure to install a version of Appium that supports your target driver version. The requirements
and prerequisites of Appium itself can be found in [the Appium documentation](https://appium.io/docs/en/latest/quickstart/install/).

| WinCore driver version | Supported Appium server version |
| --- | --- |
| >= 4.0.0 | Appium 4 |
| < 4.0.0 | Appium 3 |

!!! note

    Appium 4 is currently published under the npm `beta` tag, so it must be requested explicitly.
    A plain `npm install -g appium` installs Appium 3, which the latest driver version does not
    support:

    ```bash
    npm install -g appium@beta
    ```

## Installation

Provided you have set up the above prerequisites, you can install the driver using Appium's
[extension CLI](https://appium.io/docs/en/latest/cli/extensions/):

```bash
appium driver install --source=npm appium-wincore-driver
```

You can also specify an exact driver version:

```bash
appium driver install --source=npm appium-wincore-driver@4.0.9
```

Alternatively, if you are running a Node.js project, you can include `appium-wincore-driver` as one
of your project dependencies. [Refer to the Appium documentation](https://appium.io/docs/en/latest/guides/managing-exts/#do-it-yourself-with-npm)
for more information about this approach.

### Verify the Installation

In order to check that the driver was installed correctly, simply launch the Appium server:

```bash
appium
```

The server log output should include a line like the following:

```
[Appium] AppiumWincoreDriver has been successfully loaded in 0.780s
```

By default the server listens on `http://127.0.0.1:4723`.

## Creating a Session

The WinCore driver, like all Appium drivers, requires providing [specific capabilities](https://appium.io/docs/en/latest/guides/caps/)
in order to start a new session. The following example lists the minimum required capabilities for
a basic session:

```json
// This will start a session that launches Windows Calculator
{
  "platformName": "Windows",
  "appium:automationName": "Wincore",
  "appium:app": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
}
```

[`appium:app`](../reference/capabilities.md#app) accepts an `.exe` path, a UWP application user
model ID (as above), or `Root` to attach to the whole desktop. To attach to a window that is already
open instead, use [`appium:appTopLevelWindow`](../reference/capabilities.md#apptoplevelwindow).

See [the Capabilities reference page](../reference/capabilities.md) for more information on the
capabilities supported by the driver, and [the Examples guide](../guides/examples.md) for complete
tests in several client languages.
