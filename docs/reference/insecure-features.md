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
