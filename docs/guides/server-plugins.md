---
title: Server plugins
---

`WincoreServer.exe` loads external .NET plugins at startup. A plugin adds
JSON-RPC command handlers and one tree provider: a source of elements that
live outside the real UIA tree.

## Loading

The server reads plugin directories from the `WINCORE_SERVER_PLUGINS`
environment variable (`;`-separated). Typically an Appium plugin sets it
before the driver spawns the server.

Each plugin directory contains:

- `plugin.json` — the manifest
- an assembly implementing `IServerPlugin`

The contract is published as the `WincoreServerSdk` NuGet package (source:
`csharp/WincoreServerSdk/`). The loader and registry live in
`csharp/WincoreServer/Plugins/`.

## Tree providers

An `ITreeProvider` owns elements addressed by an element-id prefix (for
example `myprovider:`).

Element-scoped commands are routed centrally. Each command is registered
in `CommandDispatcher.AddElementRoutes` with:

- a UIA handler, which receives the resolved UIA element, and
- a provider handler (`ElementRoute`), which receives the provider element.

Handlers never inspect ids themselves. A command with no provider handler
is UIA-only — window operations and the session root, for example.

Find, XPath and page source are routed per window
(`TryResolveWindow(hwnd)`) and stay bespoke in their handlers.

`FindItemInContainer` is optional. It backs
[`windows: selectFromCombobox`](../reference/execute-methods.md#windows-selectfromcombobox),
and can return entries a container has not created yet. When a provider
does not implement it, or returns null, the driver searches the container's
current descendants instead.

## Compatibility

New `ITreeProvider` capabilities get a default "not supported"
implementation, so plugins built against an older SDK keep loading.
