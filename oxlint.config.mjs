import appiumConfig, {defineConfig, ignorePatterns} from '@appium/oxc-config/oxlint';

export default defineConfig({
  extends: [appiumConfig],
  ignorePatterns: [
    ...ignorePatterns,
    // Non-JS native/tooling sources
    'csharp/**',
    'iebridge/**',
    'native/**',
    'examples/**',
    'test/fixtures/**',
  ],
  overrides: [
    {
      // The base rule misreads TS declaration merging (`const X = {...} as const` +
      // `type X = ...`), which the enum-like modules rely on; tsc already rejects
      // genuine redeclarations.
      files: ['**/*.ts', '**/*.mts'],
      rules: {
        'no-redeclare': 'off',
      },
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['docs/**/*.js'],
      env: {
        browser: true,
      },
    },
  ],
});
