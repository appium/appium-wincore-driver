/**
 * Shared mocks for unit tests: `lib/util`'s `sleep` becomes a no-op and `node:path`'s `normalize` an identity function,
 * so tests are fast and platform-independent. Call (and await) before importing the code under test.
 * A test file that needs a different `lib/util` mock must not use this and mock `lib/util.js` itself
 * (a module can only be mocked once per process).
 */
import {mock} from 'node:test';

export async function mockCommonModules() {
  const utilUrl = new URL('../../lib/util.js', import.meta.url).href;
  const sleep = mock.fn(async (..._args: any[]): Promise<void> => {});
  mock.module(utilUrl, {exports: {...(await import(utilUrl)), sleep}});

  const actualPath = await import('node:path');
  const normalize = (p: string) => p;
  mock.module('node:path', {
    exports: {...actualPath, default: {...actualPath.default, normalize}, normalize},
  });
  return {sleep};
}
