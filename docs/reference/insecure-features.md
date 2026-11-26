---
title: Insecure Features
---

Some [insecure driver features](https://appium.io/docs/en/latest/guides/security/) are disabled by
default. They can be enabled upon launching Appium as follows:

```bash
appium --allow-insecure wincore:<feature-name>
```

or

```bash
appium --relaxed-security
```

For other insecure feature names recognized by the Appium server, see
[their Appium docs reference page](https://appium.io/docs/en/latest/reference/cli/insecure-features/).

## `modify_fs`

Allows changing the file system of the machine running Appium. Required by
[`windows: deleteFile`](./execute-methods.md#windows-deletefile),
[`windows: deleteFolder`](./execute-methods.md#windows-deletefolder), and the standard Push File
and Pull File commands.

## `chromedriver_allow_any_executable`

Allows using ChromeDriver and Edge WebDriver executables from sources that are not verified when
switching to a web view context. By default, only the following executables are started:

* Builds known to [`appium-chromedriver`](https://github.com/appium/appium-android/tree/main/packages/chromedriver)
* ChromeDriver builds downloaded automatically by the driver, and Edge WebDriver builds downloaded
  from the official Microsoft CDN. Their checksums are recorded upon download.

Enable it to use custom builds set via
[`appium:chromedriverExecutablePath`](./capabilities.md#chromedriverexecutablepath) or
[`appium:edgedriverExecutablePath`](./capabilities.md#edgedriverexecutablepath), or a custom
[`appium:chromedriverCdnUrl`](./capabilities.md#chromedrivercdnurl) or
[`appium:edgedriverCdnUrl`](./capabilities.md#edgedrivercdnurl) (downloads from the latter two are
trusted without being checked against known builds). Only enable it if you trust
everyone who is able to create sessions.
