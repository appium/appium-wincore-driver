import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createWinformComboSession, quitSession} from './helpers/session.js';

// Regression for SessionState.SaveElementAndReturnId's uuid fallback
// (csharp/WincoreServer/State/SessionState.cs): elements whose
// native UIA RuntimeId is null/empty must still be findable and usable,
// keyed by a generated GUID instead of a dot-joined RuntimeId.
//
// winform-combo's NoRuntimeIdHost (appium-wincore-test-apps/winform-combo/Program.cs)
// registers a raw UIA provider whose child fragment has no backing HWND, so
// nothing auto-derives a RuntimeId for it — GetRuntimeId() genuinely returns
// null, verified directly against the OS UIA client (not just this driver).
describe('elements with no native RuntimeId (uuid fallback)', () => {
  let app: Browser;

  beforeEach(async () => {
    app = await createWinformComboSession();
  });

  afterEach(async () => {
    await quitSession(app);
  });

  it('finds and reads a fragment with a genuinely empty RuntimeId', async () => {
    const item = await app.$('~noRuntimeIdItem');
    assert.equal(await item.getAttribute('name'), 'No RuntimeId Item');
    assert.equal(await item.getAttribute('runtimeid'), '');
  });

  it('assigns a GUID-shaped element id instead of a dot-joined RuntimeId', async () => {
    const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const item = await app.$('~noRuntimeIdItem');
    assert.match((item as any).elementId, GUID_RE);

    // Contrast: a real control still gets a dot-joined RuntimeId id.
    const txtLog = await app.$('~txtLog');
    assert.match((txtLog as any).elementId, /^\d+(\.\d+)+$/);
  });
});
