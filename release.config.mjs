import releaseConfig from '@appium/semantic-release-config';

const config = releaseConfig({
  branches: ['main', {name: 'develop', prerelease: 'preview'}],
  // Long-lived Appium 4 integration branch: every merge publishes an
  // `X.0.0-beta.N` prerelease to the `beta` npm dist-tag, leaving `latest` alone.
  betaBranch: 'beta',
});

// Publishing is done by CI from a staged, bundled package (appium-workflows'
// publish-npm-bundle action), so the npm plugin only bumps package.json's version.
config.plugins = config.plugins.map((plugin) =>
  plugin === '@semantic-release/npm' ? ['@semantic-release/npm', {npmPublish: false}] : plugin,
);

export default config;
