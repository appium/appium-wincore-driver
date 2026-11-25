# Contributing to Appium WinCore Driver

Thanks for helping improve the driver. Bug reports, docs fixes, and code
changes are all welcome.

## Before you start

- **Questions and ideas:** open a
  [Discussion](https://github.com/appium/appium-wincore-driver/discussions)
  first. It is the fastest way to check whether a change fits.
- **Bugs:** open an
  [Issue](https://github.com/appium/appium-wincore-driver/issues) using the
  bug report template. Include the driver version, Appium version, the
  target app's UI framework (WPF, WinForms, UWP, Win32), and the Appium
  server log.
- **First contribution?** Look for issues labelled
  [`good first issue`](https://github.com/appium/appium-wincore-driver/labels/good%20first%20issue).

## Development setup

You need Windows 10 or later, Node.js, and the .NET SDK (only if you change
the native server under `csharp/`).

```bash
npm install
npm run lint
npm run build
npm run test
```

| Script | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript to `build/` |
| `npm run build:native` | Publish `WincoreServer.exe` to `native/win-x64/` |
| `npm run lint` | oxlint |
| `npm run format` | oxfmt |
| `npm run test` | Unit tests (`node:test`) |
| `npm run test:e2e` | End-to-end tests (Windows and Appium) |

Run a single test file:

```bash
npm run build && node --enable-source-maps --experimental-test-module-mocks --test build/test/path/to/file.test.js
```

The repository uses
[Comment Tagged Templates](https://marketplace.visualstudio.com/items?itemName=bierner.comment-tagged-templates)
for PowerShell/C syntax highlighting in VS Code.

## Pull requests

- PR titles follow [Conventional Commits](https://www.conventionalcommits.org/),
  for example `fix: handle empty combo box` or `docs: add WPF example`.
  A CI check enforces this, and releases are generated from the titles.
- Add or update tests for behaviour changes.
- Update the docs under `docs/` when you change capabilities, locator
  strategies, or `windows:` execute methods.
- Make sure `npm run lint`, `npm run format:check`, and `npm run test` pass.

## Documentation

The docs site is built with
[`@appium/docutils`](https://www.npmjs.com/package/@appium/docutils).
Preview it locally:

```bash
npm run install-docs-deps
npm run dev:docs
```

More detail, including performance benchmarks and server plugins, is in the
[contributing section of the docs](https://appium.github.io/appium-wincore-driver/latest/contributing/).

## Code of conduct

This project follows the
[Appium Code of Conduct](https://github.com/appium/.github/blob/master/CODE_OF_CONDUCT.md).
