import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import * as support from 'appium/support.js';

import {assertCalled, assertCalledWith, assertNotCalled, calls, clearCalls, queueResolved} from '../helpers/mock.js';

const utilUrl = new URL('../../lib/util.js', import.meta.url).href;
const actualUtil = await import(utilUrl);
const cdpRequest = mock.fn(async (..._args: any[]): Promise<any> => undefined);
const downloadFile = mock.fn(async (..._args: any[]) => undefined);
mock.module(utilUrl, {
  exports: {
    ...actualUtil,
    cdpRequest,
    downloadFile,
    sleep: mock.fn(async () => undefined),
    MODULE_NAME: 'appium-wincore-driver',
    currentFilename: '/mock/root/build/lib/util.js',
  },
});

const Chromedriver = mock.fn(function () {
  return {
    start: mock.fn(async () => undefined),
    stop: mock.fn(async () => undefined),
    proxyReq: mock.fn(),
    jwproxy: {command: mock.fn()},
    sessionId: mock.fn(() => 'mock-session-id'),
  };
});
mock.module('appium-chromedriver', {exports: {Chromedriver}});

mock.module('appium/support.js', {
  exports: {
    ...support,
    fs: {
      ...support.fs,
      exists: mock.fn(async (..._args: any[]) => true),
      mkdir: mock.fn(async () => undefined),
      mv: mock.fn(async () => undefined),
      rimraf: mock.fn(async () => undefined),
      walkDir: mock.fn(async () => '/tmp/chromedriver.exe'),
    },
    node: {
      ...support.node,
      getModuleRootSync: mock.fn(() => '/mock/root'),
    },
    system: {
      ...support.system,
      arch: mock.fn(async () => '64'),
    },
    zip: {
      ...support.zip,
      extractAllTo: mock.fn(async () => undefined),
    },
    tempDir: {
      ...support.tempDir,
      openDir: mock.fn(async () => '/tmp/mock-dir'),
    },
  },
});

const contexts = await import('../../lib/commands/contexts.js');
const {fs, system} = (await import('appium/support.js')) as any;

const mockedCdpRequest = cdpRequest;
const mockedDownloadFile = downloadFile;

function clearAll() {
  clearCalls(cdpRequest, downloadFile, Chromedriver, fs.exists, fs.mkdir, fs.mv, fs.rimraf, fs.walkDir);
}

/** Makes the next `new Chromedriver()` return `instance`. */
function nextChromedriver(instance: any) {
  Chromedriver.mock.mockImplementationOnce(function () {
    return instance;
  }, Chromedriver.mock.callCount());
}

/** Asserts some call's first arg contains `part` and its second arg is a string. */
function assertCalledWithUrlPart(fn: (...args: any[]) => any, part: string) {
  assert.ok(
    calls(fn).some(([url, dest]) => typeof url === 'string' && url.includes(part) && typeof dest === 'string'),
    `expected a call with url containing ${part}, got ${JSON.stringify(calls(fn))}`,
  );
}

function createMockDriver(capsOverrides: Record<string, unknown> = {}): any {
  return {
    caps: {
      webviewEnabled: true,
      app: 'C:\\App\\app.exe',
      ...capsOverrides,
    },
    basePath: undefined,
    chromedriver: null,
    jwpProxyActive: false,
    proxyReqRes: null,
    proxyCommand: null,
    currentContext: null,
    webviewDevtoolsPort: 10900,
    log: {debug: mock.fn(), info: mock.fn(), warn: mock.fn()},
    getCurrentContext: contexts.getCurrentContext,
    getContexts: contexts.getContexts,
    setContext: contexts.setContext,
    getWebViewDetails: contexts.getWebViewDetails,
  };
}

const MOCK_VERSION_RESPONSE = {
  Browser: 'Chrome/120.0.0.0',
  'Protocol-Version': '1.3',
  'User-Agent': 'Mock',
  'V8-Version': '12.0',
  'WebKit-Version': '537.36',
  webSocketDebuggerUrl: 'ws://localhost:10900/devtools/browser/abc',
};

const MOCK_PAGES = [
  {
    description: '',
    devtoolsFrontendUrl: '',
    faviconUrl: '',
    id: 'page1',
    title: 'Test Page',
    type: 'page',
    url: 'https://example.com',
    webSocketDebuggerUrl: 'ws://localhost:10900/devtools/page/page1',
  },
  {
    description: '',
    devtoolsFrontendUrl: '',
    faviconUrl: '',
    id: 'page2',
    title: 'Another Page',
    type: 'page',
    url: 'https://other.com',
    webSocketDebuggerUrl: 'ws://localhost:10900/devtools/page/page2',
  },
];

describe('getWebViewDetails', () => {
  beforeEach(clearAll);

  it('throws InvalidArgumentError when webviewEnabled is false', async () => {
    const driver = createMockDriver({webviewEnabled: false});
    await assert.rejects(contexts.getWebViewDetails.call(driver), /WebView support is not enabled/);
  });

  it('throws when app is none and webviewDevtoolsPort is not set', async () => {
    const driver = createMockDriver({app: 'none', webviewDevtoolsPort: undefined});
    driver.webviewDevtoolsPort = null;
    await assert.rejects(contexts.getWebViewDetails.call(driver), /webviewDevtoolsPort/);
  });

  it('throws when app is root and webviewDevtoolsPort is not set', async () => {
    const driver = createMockDriver({app: 'root', webviewDevtoolsPort: undefined});
    driver.webviewDevtoolsPort = null;
    await assert.rejects(contexts.getWebViewDetails.call(driver), /webviewDevtoolsPort/);
  });

  it('throws when appTopLevelWindow is set and webviewDevtoolsPort is not set', async () => {
    const driver = createMockDriver({appTopLevelWindow: '0x1234', webviewDevtoolsPort: undefined});
    driver.webviewDevtoolsPort = null;
    await assert.rejects(contexts.getWebViewDetails.call(driver), /webviewDevtoolsPort/);
  });

  it('returns info undefined and pages undefined when CDP not reachable', async () => {
    mockedCdpRequest.mock.mockImplementation(async () => {
      throw new Error('ECONNREFUSED');
    });
    const driver = createMockDriver();
    const result = await contexts.getWebViewDetails.call(driver);
    assert.deepEqual(result, {info: undefined, pages: undefined});
  });

  it('returns CDP data when reachable', async () => {
    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    const result = await contexts.getWebViewDetails.call(driver);
    assert.deepEqual(result.info, MOCK_VERSION_RESPONSE);
    assert.deepEqual(result.pages, MOCK_PAGES);
  });
});

describe('getContexts', () => {
  beforeEach(clearAll);

  it('returns NATIVE_APP plus WEBVIEW_ entries from page list', async () => {
    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    const result = await contexts.getContexts.call(driver);
    assert.deepEqual(result, ['NATIVE_APP', 'WEBVIEW_page1', 'WEBVIEW_page2']);
  });

  it('returns only NATIVE_APP when no pages available', async () => {
    mockedCdpRequest.mock.mockImplementation(async () => {
      throw new Error('ECONNREFUSED');
    });
    const driver = createMockDriver();
    const result = await contexts.getContexts.call(driver);
    assert.deepEqual(result, ['NATIVE_APP']);
  });
});

describe('getCurrentContext', () => {
  it('returns NATIVE_APP by default', async () => {
    const driver = createMockDriver();
    driver.currentContext = null;
    const result = await contexts.getCurrentContext.call(driver);
    assert.equal(result, 'NATIVE_APP');
  });

  it('returns stored context when set', async () => {
    const driver = createMockDriver();
    driver.currentContext = 'WEBVIEW_page1';
    const result = await contexts.getCurrentContext.call(driver);
    assert.equal(result, 'WEBVIEW_page1');
  });
});

describe('setContext', () => {
  beforeEach(clearAll);

  it('switches to NATIVE_APP: stops chromedriver, clears proxy flags', async () => {
    const mockCd = {stop: mock.fn(async () => undefined)};
    const driver = createMockDriver();
    driver.chromedriver = mockCd;
    driver.jwpProxyActive = true;

    await contexts.setContext.call(driver, 'NATIVE_APP');

    assertCalled(mockCd.stop);
    assert.equal(driver.chromedriver, null);
    assert.equal(driver.jwpProxyActive, false);
    assert.equal(driver.proxyReqRes, null);
    assert.equal(driver.proxyCommand, null);
    assert.equal(driver.currentContext, 'NATIVE_APP');
  });

  it('switches to NATIVE_APP when null passed', async () => {
    const driver = createMockDriver();
    await contexts.setContext.call(driver, null);
    assert.equal(driver.currentContext, 'NATIVE_APP');
  });

  it('throws InvalidArgumentError when page not in page list', async () => {
    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    await assert.rejects(contexts.setContext.call(driver, 'WEBVIEW_nonexistent'), /Web view not found/);
  });

  it('throws InvalidArgumentError for unsupported browser type', async () => {
    const unsupportedVersionResponse = {...MOCK_VERSION_RESPONSE, Browser: 'Firefox/120.0'};
    queueResolved(mockedCdpRequest, unsupportedVersionResponse, MOCK_PAGES);
    const driver = createMockDriver();
    await assert.rejects(contexts.setContext.call(driver, 'WEBVIEW_page1'), /Unsupported browser type/);
  });

  it('throws InvalidArgumentError for invalid browser version format', async () => {
    const badVersionResponse = {...MOCK_VERSION_RESPONSE, Browser: 'Chrome/120'};
    queueResolved(mockedCdpRequest, badVersionResponse, MOCK_PAGES);
    const driver = createMockDriver();
    await assert.rejects(contexts.setContext.call(driver, 'WEBVIEW_page1'), /Invalid browser version/);
  });

  it('handles Edge browser type (Edg/ prefix)', async () => {
    const edgeVersionResponse = {...MOCK_VERSION_RESPONSE, Browser: 'Edg/120.0.0.0'};
    queueResolved(mockedCdpRequest, edgeVersionResponse, MOCK_PAGES);
    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');
    assert.equal(driver.jwpProxyActive, true);
  });

  it('sets jwpProxyActive to true after successful start', async () => {
    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');
    assert.equal(driver.jwpProxyActive, true);
    assert.equal(driver.currentContext, 'WEBVIEW_page1');
  });

  it('passes correct debuggerAddress extracted from webSocketDebuggerUrl', async () => {
    const mockStart = mock.fn(async () => undefined);
    const mockCdInstance = {
      start: mockStart,
      stop: mock.fn(),
      proxyReq: mock.fn(),
      jwproxy: {command: mock.fn()},
      sessionId: mock.fn(() => 'mock-session-id'),
    };
    nextChromedriver(mockCdInstance);

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');

    assertCalledWith(mockStart, {
      'ms:edgeOptions': {debuggerAddress: 'localhost:10900'},
      'goog:chromeOptions': {debuggerAddress: 'localhost:10900'},
    });
  });

  it('carries the session implicit wait over to the new Chromedriver session', async () => {
    const mockCommand = mock.fn(async () => null);
    nextChromedriver({
      start: mock.fn(async () => undefined),
      stop: mock.fn(),
      proxyReq: mock.fn(),
      jwproxy: {command: mockCommand},
      sessionId: mock.fn(() => 'mock-session-id'),
    });

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    driver.implicitWaitMs = 5000;
    await contexts.setContext.call(driver, 'WEBVIEW_page1');

    assertCalledWith(mockCommand, '/timeouts', 'POST', {implicit: 5000});
  });

  it('leaves Chromedriver timeouts alone when no implicit wait is set', async () => {
    const mockCommand = mock.fn();
    nextChromedriver({
      start: mock.fn(async () => undefined),
      stop: mock.fn(),
      proxyReq: mock.fn(),
      jwproxy: {command: mockCommand},
      sessionId: mock.fn(() => 'mock-session-id'),
    });

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');

    assertNotCalled(mockCommand);
  });
});

describe('getDriverExecutable', () => {
  beforeEach(() => {
    clearAll();
    system.arch = mock.fn(async () => '64');
  });

  it('returns cached path when driver binary already exists', async () => {
    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);
    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');
    assert.ok(calls(fs.exists).some(([p]) => String(p).includes('chromedriver')));
    assert.equal(driver.jwpProxyActive, true);
  });

  it('returns chromedriverExecutablePath cap when set and file exists', async () => {
    // driverDir exists, cached path does NOT exist, cap path exists
    queueResolved(fs.exists, true, false, true);

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);

    const driver = createMockDriver({chromedriverExecutablePath: 'C:\\drivers\\chromedriver.exe'});
    await contexts.setContext.call(driver, 'WEBVIEW_page1');
    assert.equal(driver.jwpProxyActive, true);
  });

  it('throws when chromedriverExecutablePath cap set but file missing', async () => {
    // driverDir exists, cached path does NOT exist, cap path also missing
    queueResolved(fs.exists, true, false, false);

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);

    const driver = createMockDriver({chromedriverExecutablePath: 'C:\\drivers\\chromedriver.exe'});
    await assert.rejects(contexts.setContext.call(driver, 'WEBVIEW_page1'), /Driver executable not found at/);
  });

  it('builds correct Chrome CDN download URL for win64', async () => {
    // driverDir exists, no cached binary - trigger download
    queueResolved(fs.exists, true, false);

    queueResolved(mockedCdpRequest, MOCK_VERSION_RESPONSE, MOCK_PAGES);

    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');

    assertCalledWithUrlPart(mockedDownloadFile, 'storage.googleapis.com');
    assertCalledWithUrlPart(mockedDownloadFile, '120.0.0.0');
  });

  it('builds correct Edge CDN download URL', async () => {
    const edgeVersionResponse = {...MOCK_VERSION_RESPONSE, Browser: 'Edg/120.0.0.0'};

    // driverDir exists, no cached binary
    queueResolved(fs.exists, true, false);

    queueResolved(mockedCdpRequest, edgeVersionResponse, MOCK_PAGES);

    const driver = createMockDriver();
    await contexts.setContext.call(driver, 'WEBVIEW_page1');

    assertCalledWithUrlPart(mockedDownloadFile, 'msedgedriver.microsoft.com');
  });
});
