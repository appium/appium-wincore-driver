import {resolve} from 'node:path';

import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/e2e/**/*.e2e.ts'],
    // No setupFiles — real I/O, no mocks
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // UI automation is inherently flaky — retry once so a pass-on-retry
    // (flaky) is distinguishable in the JUnit report from a hard failure.
    retry: 1,
    reporters: ['default', 'junit'],
    outputFile: {junit: './test-results/e2e-junit.xml'},
    pool: 'forks',
    // sequential execution — only one app on screen at a time
    maxWorkers: 1,
    isolate: false,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'lib'),
    },
  },
});
