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

## `chromedriver_allow_any_executable`

Allows using ChromeDriver and Edge WebDriver executables that are not known to
[`appium-chromedriver`](https://github.com/appium/appium-android/tree/main/packages/chromedriver)
when switching to a web view context. By default, only the following executables are started:

* Builds known to `appium-chromedriver`
* Builds downloaded by the driver from the official Chrome for Testing and Microsoft CDNs, or from
  the location set by the `WINCORE_CHROMEDRIVER_CDN_URL` / `WINCORE_EDGEDRIVER_CDN_URL`
  [environment variables](../guides/hybrid.md#troubleshooting) of the Appium server. Their
  checksums are recorded upon download.

Enable it to use unknown builds set via
[`appium:chromedriverExecutablePath`](./capabilities.md#chromedriverexecutablepath) or
[`appium:edgedriverExecutablePath`](./capabilities.md#edgedriverexecutablepath). Nothing is
recorded as trusted, so disabling the feature restores the verification. Only enable it if you
trust everyone who is able to create sessions.

## `modify_fs`

Allows changing the file system of the machine running Appium. Required by
[`windows: deleteFile`](./execute-methods.md#windows-deletefile),
[`windows: deleteFolder`](./execute-methods.md#windows-deletefolder), and the standard Push File
and Pull File commands.
