# Quickstart

Appium WinCore Driver automates Windows desktop applications through the
standard Appium / WebDriver API. This page gets the driver installed and an
Appium server running; [Your first test](first-test.md) then drives a real
application.

## Requirements

- Windows 10 or later
- [Node.js](https://nodejs.org) LTS
- [Appium 4](https://appium.io/docs/en/latest/quickstart/install/)

!!! note

    Since v4, this driver is only compatible with Appium server v4. Use
    driver v3.x with Appium 3.

## Install Appium

```bash
npm install -g appium
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
and continue with [Your first test](first-test.md).
