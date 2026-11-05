# Contributing

## Development setup

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
| `npm run test:e2e` | End-to-end tests (Windows + Appium) |

Run a single test file:

```bash
npm run build && node --enable-source-maps --experimental-test-module-mocks --test build/test/path/to/file.test.js
```

The repository uses
[Comment Tagged Templates](https://marketplace.visualstudio.com/items?itemName=bierner.comment-tagged-templates)
for PowerShell/C syntax highlighting in VS Code.

## Documentation

This site is built with
[MkDocs Material](https://squidfunk.github.io/mkdocs-material/) from the
`docs/` folder. Preview it locally:

```bash
pip install -r docs/requirements.txt
npm run docs:serve
```

Then open <http://127.0.0.1:8000>. Pages are published to GitHub Pages
automatically when `docs/` changes on `main`.

## Performance

Benchmarks and the `perfMetrics` capability are described in
[Performance](performance.md).
