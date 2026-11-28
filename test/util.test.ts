/**
 * Unit tests for lib/util.ts
 */
import assert from 'node:assert/strict';
import {afterEach, describe, it, mock} from 'node:test';

import {assertIntegerCap, assertSupportedEasingFunction, resolveChromeDriverVersion} from '../lib/util.js';

describe('assertIntegerCap', () => {
  it('accepts value equal to min', () => {
    assert.doesNotThrow(() => assertIntegerCap('x', 0, 0));
    assert.doesNotThrow(() => assertIntegerCap('x', 1, 1));
  });

  it('accepts value above min', () => {
    assert.doesNotThrow(() => assertIntegerCap('x', 5, 1));
    assert.doesNotThrow(() => assertIntegerCap('x', 100, 0));
  });

  it('throws for floats', () => {
    assert.throws(() => assertIntegerCap('x', 1.5, 1), /must be an integer/);
    assert.throws(() => assertIntegerCap('x', 0.1, 0), /must be an integer/);
  });
});

describe('assertSupportedEasingFunction', () => {
  for (const value of ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']) {
    it(`accepts "${value}"`, () => {
      assert.doesNotThrow(() => assertSupportedEasingFunction(value));
    });
  }

  it('accepts cubic-bezier with valid values', () => {
    assert.doesNotThrow(() => assertSupportedEasingFunction('cubic-bezier(0.25, 0.1, 0.25, 1)'));
    assert.doesNotThrow(() => assertSupportedEasingFunction('cubic-bezier(0,0,1,1)'));
    assert.doesNotThrow(() => assertSupportedEasingFunction('cubic-bezier(0.42, 0, 1, 1)'));
    assert.doesNotThrow(() => assertSupportedEasingFunction('cubic-bezier(0, -0.5, 1, 1.5)'));
  });

  it('throws for unsupported easing function names', () => {
    assert.throws(() => assertSupportedEasingFunction('bounce'), /Unsupported or invalid easing function/);
    assert.throws(
      () => assertSupportedEasingFunction('bounce'),
      /\[linear, ease, ease-in, ease-out, ease-in-out, cubic-bezier\(x1,y1,x2,y2\)\]/,
    );
    assert.throws(() => assertSupportedEasingFunction('spring'), /Unsupported or invalid easing function/);
    assert.throws(() => assertSupportedEasingFunction(''), /Unsupported or invalid easing function/);
  });

  it('throws for malformed cubic-bezier', () => {
    // Too few args
    assert.throws(() => assertSupportedEasingFunction('cubic-bezier()'), /Unsupported or invalid easing function/);
    assert.throws(
      () => assertSupportedEasingFunction('cubic-bezier(0.25, 0.1, 0.25)'),
      /Unsupported or invalid easing function/,
    );
    // Negative x1 (regex only allows non-negative for x1 and x2)
    assert.throws(
      () => assertSupportedEasingFunction('cubic-bezier(-1, 0, 0, 1)'),
      /Unsupported or invalid easing function/,
    );
    // Non-numeric
    assert.throws(
      () => assertSupportedEasingFunction('cubic-bezier(abc, 0, 0, 1)'),
      /Unsupported or invalid easing function/,
    );
  });
});

describe('resolveChromeDriverVersion', () => {
  afterEach(() => mock.restoreAll());

  const stubFetch = (impl: () => Promise<unknown>) => mock.method(globalThis, 'fetch', impl as typeof fetch);

  it('returns the latest published patch of the same MAJOR.MINOR.BUILD', async () => {
    stubFetch(async () => Response.json({builds: {'120.0.6099': {version: '120.0.6099.109'}}}));
    assert.equal(await resolveChromeDriverVersion('120.0.6099.5'), '120.0.6099.109');
  });

  it('falls back to the browser version if the build is unknown', async () => {
    stubFetch(async () => Response.json({builds: {}}));
    assert.equal(await resolveChromeDriverVersion('120.0.6099.5'), '120.0.6099.5');
  });

  it('falls back to the browser version on a failed response or request', async () => {
    stubFetch(async () => new Response(null, {status: 500}));
    assert.equal(await resolveChromeDriverVersion('120.0.6099.5'), '120.0.6099.5');
    mock.restoreAll();
    stubFetch(async () => {
      throw new Error('offline');
    });
    assert.equal(await resolveChromeDriverVersion('120.0.6099.5'), '120.0.6099.5');
  });
});
