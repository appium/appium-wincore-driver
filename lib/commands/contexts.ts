import {createReadStream} from 'node:fs';
import path from 'node:path';

import type {ChromedriverOpts} from 'appium-chromedriver';
import {Chromedriver, installDriverFromArchive} from 'appium-chromedriver';
import {errors} from 'appium/driver.js';
import {fs, net, node, system, tempDir} from 'appium/support.js';

import {CHROMEDRIVER_ALLOW_ANY_EXECUTABLE_FEATURE} from '../constants.js';
import type {AppiumWincoreDriver} from '../driver.js';
import {cdpRequest, currentFilename, sleep, MODULE_NAME} from '../util.js';

const NATIVE_APP = 'NATIVE_APP';
const WEBVIEW = 'WEBVIEW';
const WEBVIEW_BASE = `${WEBVIEW}_`;

/**
 * Gets the name of the currently active context (`NATIVE_APP` or a `WEBVIEW_<id>` handle).
 * @returns The current context name.
 */
export async function getCurrentContext(this: AppiumWincoreDriver): Promise<string> {
  return (this.currentContext ??= NATIVE_APP);
}

/**
 * Switches the active context. Switching to `NATIVE_APP` (or omitting the name) stops any
 * running Chromedriver/proxy; switching to a `WEBVIEW_<id>` handle resolves the matching
 * Chromium/Edge webview via CDP, resolves (downloads or reuses) a matching chromedriver/edgedriver
 * executable, and starts proxying WebDriver commands to it.
 * @param name - The context name to switch to, or `null`/omitted for `NATIVE_APP`.
 * @returns Resolves once the context switch (and, for webviews, chromedriver startup) completes.
 */
export async function setContext(this: AppiumWincoreDriver, name?: string | null): Promise<void> {
  if (!name || name === NATIVE_APP) {
    await this.chromedriver?.stop();
    this.chromedriver = null;
    this.jwpProxyActive = false;
    this.proxyReqRes = null;
    this.proxyCommand = null;
    this.currentContext = NATIVE_APP;
    return;
  }

  const webViewDetails = await this.getWebViewDetails();

  if (!(webViewDetails.pages ?? []).map((page) => page.id).includes(name.replace(WEBVIEW_BASE, ''))) {
    throw new errors.InvalidArgumentError(`Web view not found: ${name}`);
  }

  const browser = webViewDetails.info?.Browser ?? '';
  const match = browser.match(/(Chrome|Edg)\/([\d.]+)/);

  if (!match?.[1] || (match[1] !== 'Edg' && match[1] !== 'Chrome')) {
    throw new errors.InvalidArgumentError(`Unsupported browser type: ${match?.[1]}`);
  }

  const browserType = match[1] === 'Edg' ? 'Edge' : 'Chrome';
  const browserVersion = match?.[2] ?? '';

  const DRIVER_VERSION_REGEX = /^\d+(\.\d+){3}$/;
  if (!DRIVER_VERSION_REGEX.test(browserVersion)) {
    throw new errors.InvalidArgumentError(`Invalid browser version: ${browserVersion}`);
  }

  this.log.debug(`Type: ${browserType}, Version: ${browserVersion}`);

  const driverDir = await getDriverDir.call(this, browserType);
  // Chrome: chromedriver downloads and trusts the matching build itself (checksum-verified);
  // Edge is not supported by its downloader, so we fetch msedgedriver ourselves
  const executable = await getDriverExecutable.call(this, browserType, browserVersion, driverDir);

  const chromedriverOpts: ChromedriverOpts & {details?: WebViewDetails} = {
    executable,
    executableDir: driverDir,
    isAutodownloadEnabled: browserType === 'Chrome',
    // chromedriver >= 11 rejects executables missing from its checksum allowlist
    allowUnverifiedExecutable: this.isFeatureEnabled(CHROMEDRIVER_ALLOW_ANY_EXECUTABLE_FEATURE),
    details: webViewDetails,
  };

  if (this.basePath) {
    chromedriverOpts.reqBasePath = this.basePath;
  }

  const cd = new Chromedriver(chromedriverOpts);
  this.chromedriver = cd;

  const page = webViewDetails.pages?.find((p) => p.id === name.replace(WEBVIEW_BASE, ''));

  const debuggerAddress = (page?.webSocketDebuggerUrl ?? '').replace('ws://', '').split('/')[0];

  const options = {debuggerAddress};

  const caps = {
    'ms:edgeOptions': options,
    'goog:chromeOptions': options,
  };

  this.currentContext = name;
  await this.chromedriver.start(caps);
  this.log.debug('Chromedriver started. Session ID:', cd.sessionId());

  // WebDriver timeouts belong to the session, not the context: the fresh Chromedriver
  // session starts with implicit wait 0, so carry over whatever the client already set.
  // Without this, finds in the webview fail instantly while the page is still loading.
  if (this.implicitWaitMs) {
    await this.chromedriver.jwproxy.command('/timeouts', 'POST', {implicit: this.implicitWaitMs});
  }

  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.proxyCommand = this.chromedriver.jwproxy.command.bind(this.chromedriver.jwproxy);
  this.jwpProxyActive = true;
}

/**
 * Lists all available contexts: the native app plus one `WEBVIEW_<id>` entry per open
 * webview page discovered via CDP.
 * @returns The list of available context names.
 */
export async function getContexts(this: AppiumWincoreDriver): Promise<string[]> {
  const webViewDetails = await this.getWebViewDetails();
  return [NATIVE_APP, ...(webViewDetails.pages?.map((page) => `${WEBVIEW_BASE}${page.id}`) ?? [])];
}

export interface WebViewDetails {
  /**
   * Web view details as returned by /json/version CDP endpoint
   * @example
   * {
   *  "Browser": "Edg/145.0.3800.97",
   *  "Protocol-Version": "1.3",
   *  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0",
   *  "V8-Version": "14.5.40.9",
   *  "WebKit-Version": "537.36 (@f4c49d5241f148220b99eb7f045ac370a1694a15)",
   *  "webSocketDebuggerUrl": "ws://localhost:10900/devtools/browser/7039e1b9-f75d-44eb-8583-7279c107bb18"
   * }
   */
  info?: CDPVersionResponse;

  /**
   * Web view details as returned by /json/list CDP endpoint
   * @example // TODO: change example to not include Spotify / use mock data
   * [ {
   *    "description": "",
   *    "devtoolsFrontendUrl": "https://chrome-devtools-frontend.appspot.com/serve_rev/@80be69ef794ba862ff256b0b23f051cbbc32e1ed/inspector.html?ws=localhost:9222/devtools/page/21C6035BC3E0A67D0BB6AE10F4A66D4A",
   *    "faviconUrl": "https://xpui.app.spotify.com/favicon.ico",
   *    "id": "21C6035BC3E0A67D0BB6AE10F4A66D4A",
   *    "title": "Spotify - Web Player: Music for everyone",
   *    "type": "page",
   *    "url": "https://xpui.app.spotify.com/index.html",
   *    "webSocketDebuggerUrl": "ws://localhost:9222/devtools/page/21C6035BC3E0A67D0BB6AE10F4A66D4A"
   * }, {
   *    "description": "",
   *    "devtoolsFrontendUrl": "https://chrome-devtools-frontend.appspot.com/serve_rev/@80be69ef794ba862ff256b0b23f051cbbc32e1ed/inspector.html?ws=localhost:9222/devtools/page/7E7008B3C464CD91224ADF976115101F",
   *    "id": "7E7008B3C464CD91224ADF976115101F",
   *    "title": "",
   *    "type": "worker",
   *    "url": "",
   *    "webSocketDebuggerUrl": "ws://localhost:10900/devtools/page/7E7008B3C464CD91224ADF976115101F"
   * } ]
   */
  pages?: CDPListResponse;
}

interface CDPVersionResponse {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl: string;
}

interface CDPListResponseEntry {
  description: string;
  devtoolsFrontendUrl: string;
  faviconUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

type CDPListResponse = CDPListResponseEntry[];

/**
 * Queries the app's CDP endpoint (`/json/version` and `/json/list`) for available webview
 * pages. Requires the `webviewEnabled` capability.
 * @param waitForWebviewMs - Optional delay, in milliseconds, to wait before querying (useful
 * while a webview is still initializing).
 * @returns The CDP version info and list of open pages.
 */
export async function getWebViewDetails(this: AppiumWincoreDriver, waitForWebviewMs?: number): Promise<WebViewDetails> {
  if (!this.caps.webviewEnabled) {
    throw new errors.InvalidArgumentError(
      'WebView support is not enabled. Please set the "appium:webviewEnabled" capability to true and try again.',
    );
  }

  this.log.debug(`Getting a list of available webviews`);

  const waitMs = waitForWebviewMs ? Number(waitForWebviewMs) : 0;
  if (waitMs) {
    this.log.debug(`waiting for ${waitMs} ms`);
    await sleep(waitMs);
  }

  const host = 'localhost';

  if (
    (this.caps.app === 'none' || this.caps.app === 'root' || this.caps.appTopLevelWindow != null) &&
    this.caps.webviewDevtoolsPort == null
  ) {
    throw new errors.InvalidArgumentError(
      `Capability "appium:webviewDevtoolsPort" must be set when using "none", "root", or "appTopLevelWindow" with "appium:webviewEnabled"`,
    );
  }

  const port = (this.webviewDevtoolsPort ??= this.caps.webviewDevtoolsPort ?? null);

  const info = await (
    cdpRequest.call(this, {host, port, endpoint: '/json/version', timeout: 10000}) as Promise<CDPVersionResponse>
  ).catch(() => undefined);
  const pages = await (
    cdpRequest.call(this, {host, port, endpoint: '/json/list', timeout: 10000}) as Promise<CDPListResponse>
  ).catch(() => undefined);

  const webViewDetails: WebViewDetails = {info, pages};

  return webViewDetails;
}

async function getDriverDir(this: AppiumWincoreDriver, browserType: 'Edge' | 'Chrome'): Promise<string> {
  const root = node.getModuleRootSync(MODULE_NAME, currentFilename);
  if (!root) {
    throw new errors.InvalidArgumentError(`Cannot find the root folder of the ${MODULE_NAME} Node.js module`);
  }

  const driverDir = path.join(root, browserType === 'Edge' ? 'msedgedriver' : 'chromedriver');
  if (!(await fs.exists(driverDir))) {
    await fs.mkdir(driverDir);
  }
  return driverDir;
}

const CDN_ENV_VARS = {
  Chrome: 'WINCORE_CHROMEDRIVER_CDN_URL',
  Edge: 'WINCORE_EDGEDRIVER_CDN_URL',
} as const;
const DEFAULT_EDGE_CDN_URL = 'https://msedgedriver.microsoft.com';

/**
 * Returns the custom CDN URL: the capability (requires the insecure feature, as the downloaded
 * binary becomes trusted), or else the server-side environment variable.
 */
function getCustomCdnUrl(this: AppiumWincoreDriver, browserType: 'Edge' | 'Chrome'): string | undefined {
  const capName = browserType === 'Edge' ? 'edgedriverCdnUrl' : 'chromedriverCdnUrl';
  const capValue = this.caps[capName];
  if (capValue) {
    if (!this.isFeatureEnabled(CHROMEDRIVER_ALLOW_ANY_EXECUTABLE_FEATURE)) {
      throw new errors.InvalidArgumentError(
        `Capability "appium:${capName}" requires the "${CHROMEDRIVER_ALLOW_ANY_EXECUTABLE_FEATURE}" insecure feature`,
      );
    }
    return capValue;
  }
  return process.env[CDN_ENV_VARS[browserType]] || undefined;
}

/**
 * Resolves the driver executable to use, or `undefined` if chromedriver should
 * pick/download a matching Chrome build on its own.
 */
async function getDriverExecutable(
  this: AppiumWincoreDriver,
  browserType: 'Edge' | 'Chrome',
  browserVersion: `${number}.${number}.${number}.${number}`,
  driverDir: string,
): Promise<string | undefined> {
  const executablePath =
    browserType === 'Edge' ? this.caps.edgedriverExecutablePath : this.caps.chromedriverExecutablePath;

  if (executablePath) {
    if (!(await fs.exists(executablePath))) {
      throw new errors.InvalidArgumentError(`Driver executable not found at path: ${executablePath}`);
    }

    this.log.debug(
      `Using local ${browserType} driver executable at ${executablePath}. ` +
        `Automatic download is disabled and CDN URLs are ignored. ` +
        `You must ensure this binary matches the WebView/Chromium version (${browserVersion}).`,
    );

    return executablePath;
  }

  const customCdnUrl = getCustomCdnUrl.call(this, browserType);
  if (browserType === 'Chrome' && !customCdnUrl) {
    return undefined;
  }

  const fileName = browserType === 'Edge' ? 'msedgedriver.exe' : 'chromedriver.exe';
  const destination = path.join(driverDir, browserVersion, fileName);

  if (await fs.exists(destination)) {
    return destination;
  }

  const arch = await system.arch();
  const url = new URL(customCdnUrl || DEFAULT_EDGE_CDN_URL);
  url.pathname = path.posix.join(
    url.pathname,
    browserVersion,
    ...(browserType === 'Edge' ? [`edgedriver_win${arch}.zip`] : [`win${arch}`, `chromedriver-win${arch}.zip`]),
  );

  this.log.debug(`Downloading ${browserType} driver version ${browserVersion} from ${url.toString()}...`);
  const tmpRoot = await tempDir.openDir();
  try {
    const archivePath = path.join(tmpRoot, 'driver.zip');
    await net.downloadFile(url.toString(), archivePath);
    // Verifies the archive content and registers its checksum as trusted for chromedriver
    return await installDriverFromArchive({
      archive: readFileChunks(archivePath),
      executableName: fileName,
      destination,
    });
  } finally {
    await fs.rimraf(tmpRoot);
  }
}

// Lazy: the file is only opened once the installer starts reading
async function* readFileChunks(filePath: string): AsyncGenerator<Uint8Array> {
  yield* createReadStream(filePath);
}
