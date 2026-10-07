import releaseConfig from '@appium/semantic-release-config';

export default releaseConfig({
  branches: ['main', {name: 'develop', prerelease: 'preview'}],
  // Long-lived Appium 4 integration branch: every merge publishes an
  // `X.0.0-beta.N` prerelease to the `beta` npm dist-tag, leaving `latest` alone.
  betaBranch: 'beta',
});
