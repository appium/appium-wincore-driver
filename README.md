# Appium WinCore Driver

Appium WinCore Driver is a Windows UI automation driver for
[Appium](https://appium.io). It automates UWP, WinForms, WPF, Win32,
and Internet Explorer applications via real UI Automation.

Key advantages over WinAppDriver:

- Faster XPath evaluation against the live UIA tree
- RawView element support (elements hidden from ContentView/ControlView)
- Standard accessibility values (`Value`, `LegacyValue`, …) on every
  element, so content that MSAA-based grids (DevExpress, DataGridView,
  VB6, Delphi) hide behind placeholder names is locatable without a
  plugin. `windows: select` / `expand` / `collapse` check they took
  effect. See
  [Locator strategies](https://appium.github.io/appium-wincore-driver/reference/locators/#standard-accessibility-values)
- Reliable text input independent of the active keyboard layout
- WebView2, Chrome, and Edge embedded content via CDP
- Internet Explorer 11 automation via built-in IE DOM Bridge
- Built-in screen recording and clipboard API

## Installation

```bash
appium driver install --source=npm appium-wincore-driver
```

Requires Appium 4 and Windows 10 or later.

> [!NOTE]
> Since v4, this driver is only compatible with Appium server v4. Use driver v3.x with Appium 3.
> Appium 4 is published on the npm `beta` tag: `npm install -g appium@beta`.

## Related projects

- [wincore-mcp](https://github.com/verisoft-ai/wincore-mcp) — MCP server for AI-agent use, driving `wincore` sessions purely over the WebDriver protocol (a separate package)

## Documentation

Full documentation lives at **<https://appium.github.io/appium-wincore-driver/>**:

- [Quickstart](https://appium.github.io/appium-wincore-driver/quickstart/) — install and run a first test
- [Capabilities](https://appium.github.io/appium-wincore-driver/reference/capabilities/)
- [Locator strategies](https://appium.github.io/appium-wincore-driver/reference/locators/)
- [`windows:` extension commands](https://appium.github.io/appium-wincore-driver/reference/commands/)
- [Guides](https://appium.github.io/appium-wincore-driver/guides/) — W3C Actions, WebView/CDP, Internet Explorer, examples
- [Architecture](https://appium.github.io/appium-wincore-driver/architecture/)

The site source is in [`docs/`](docs/); see
[Contributing](https://appium.github.io/appium-wincore-driver/contributing/) to preview it locally.

## Development

```bash
npm install
npm run lint
npm run build
npm run test
```

Uses [Comment Tagged Templates](https://marketplace.visualstudio.com/items?itemName=bierner.comment-tagged-templates)
for PowerShell/C syntax highlighting in VS Code.
