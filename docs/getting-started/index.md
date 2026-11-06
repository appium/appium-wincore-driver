---
hide:
  - navigation

title: Quickstart
---

Appium WinCore Driver automates Windows desktop applications through the
standard Appium / WebDriver API. This page gets the driver installed and an
Appium server running; [Your First Test](#your-first-test) then drives a real
application.

## Requirements

- Windows 10 or later
- [Node.js](https://nodejs.org) `^22.22.2`, `^24.15.0` or `>=26.0.0`
- [Appium 4](https://appium.io/docs/en/latest/quickstart/install/)

!!! note

    Since v4, this driver is only compatible with Appium server v4. Use
    driver v3.x with Appium 3.

## Install Appium

Appium 4 is published on the npm `beta` tag, so name it explicitly. A plain
`npm install -g appium` installs Appium 3, which this driver version does
not support.

```bash
npm install -g appium@beta
```

## Install the driver

```bash
appium driver install --source=npm appium-wincore-driver
```

Confirm it is registered:

```bash
appium driver list --installed
```

## Start the server

```bash
appium
```

By default the server listens on `http://127.0.0.1:4723`. Leave it running
and continue with [Your First Test](#your-first-test).

## Your First Test

This test opens Windows Calculator, computes `5 + 3` and reads the result.
It assumes an Appium server with the driver installed is running on
`http://127.0.0.1:4723` — see [Quickstart](index.md).

### Session capabilities

Every session needs two capabilities; `appium:app` picks what to automate:

```json
{
  "platformName": "Windows",
  "appium:automationName": "Wincore",
  "appium:app": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
}
```

`appium:app` accepts an `.exe` path, a UWP AUMID (as above), or `Root` to
attach to the whole desktop. See [Capabilities](../reference/capabilities.md)
for the full list.

### Write the test

=== "JavaScript (WebdriverIO)"

    ```bash
    npm install webdriverio
    ```

    ```js
    import { remote } from 'webdriverio';

    const driver = await remote({
      hostname: '127.0.0.1',
      port: 4723,
      capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'Wincore',
        'appium:app': 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
      },
    });

    for (const id of ['num5Button', 'plusButton', 'num3Button', 'equalButton']) {
      await driver.$(`~${id}`).click();
    }

    console.log(await driver.$('~CalculatorResults').getText());
    await driver.deleteSession();
    ```

=== "Python"

    ```bash
    pip install Appium-Python-Client
    ```

    ```python
    from appium import webdriver
    from appium.options.common import AppiumOptions
    from appium.webdriver.common.appiumby import AppiumBy

    options = AppiumOptions()
    options.load_capabilities({
        "platformName": "Windows",
        "appium:automationName": "Wincore",
        "appium:app": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
    })
    driver = webdriver.Remote("http://127.0.0.1:4723", options=options)

    for key in ("num5Button", "plusButton", "num3Button", "equalButton"):
        driver.find_element(AppiumBy.ACCESSIBILITY_ID, key).click()

    print(driver.find_element(AppiumBy.ACCESSIBILITY_ID, "CalculatorResults").text)
    driver.quit()
    ```

=== "C#"

    ```bash
    dotnet add package Appium.WebDriver
    ```

    ```csharp
    using OpenQA.Selenium.Appium;
    using OpenQA.Selenium.Appium.Windows;

    var options = new AppiumOptions
    {
        PlatformName = "Windows",
        AutomationName = "Wincore",
        App = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
    };
    using var driver = new WindowsDriver(new Uri("http://127.0.0.1:4723/"), options);

    foreach (var id in new[] { "num5Button", "plusButton", "num3Button", "equalButton" })
        driver.FindElement(MobileBy.AccessibilityId(id)).Click();

    Console.WriteLine(driver.FindElement(MobileBy.AccessibilityId("CalculatorResults")).Text);
    ```

The output is `Display is 8`.

### Next steps

- Explore the element tree with
  [Appium Inspector](https://github.com/appium/appium-inspector) or
  `driver.getPageSource()`.
- Learn the [locator strategies](../reference/locator-strategies.md), including
  native XPath.
- Browse the [`windows:` execute methods](../reference/execute-methods.md).
- See more [examples](../guides/examples.md).
