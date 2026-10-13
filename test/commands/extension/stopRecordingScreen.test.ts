/**
 * Unit tests for stopRecordingScreen extension command.
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {assertCalledWith, assertNotCalled, calls, clearCalls} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const mockUploadRecordedMedia = mock.fn(async (..._args: any[]): Promise<any> => undefined);

mockUser32(createUser32Mock());
mock.module('../../../lib/commands/screen-recorder.js', {
  exports: {
    ScreenRecorder: mock.fn(),
    DEFAULT_EXT: 'mp4',
    uploadRecordedMedia: mockUploadRecordedMedia,
  },
});
const {stopRecordingScreen} = await import('../../../lib/commands/extension.js');

describe('stopRecordingScreen', () => {
  beforeEach(() => {
    clearCalls(mockUploadRecordedMedia);
    mockUploadRecordedMedia.mock.mockImplementation(async () => 'base64data');
  });

  it('returns empty string when no recording in progress', async () => {
    const driver = createMockDriver() as any;
    driver._screenRecorder = null;

    const result = await stopRecordingScreen.call(driver);

    assert.equal(result, '');
  });

  it('returns base64 video content', async () => {
    const driver = createMockDriver() as any;
    const mockRecorder = {stop: mock.fn(async () => 'C:\\temp\\rec.mp4')};
    driver._screenRecorder = mockRecorder;
    mockUploadRecordedMedia.mock.mockImplementation(async () => 'dmlkZW8tZGF0YQ==');

    const result = await stopRecordingScreen.call(driver);

    assertCalledWith(mockRecorder.stop);
    const [[path, remotePath, opts]] = calls(mockUploadRecordedMedia);
    assert.equal(path, 'C:\\temp\\rec.mp4');
    assert.equal(remotePath, undefined);
    assert.equal(typeof opts, 'object');
    assert.notEqual(opts, null);
    assert.equal(result, 'dmlkZW8tZGF0YQ==');
  });

  it('returns empty string when stop() returns no file path', async () => {
    const driver = createMockDriver() as any;
    const mockRecorder = {stop: mock.fn(async () => '')};
    driver._screenRecorder = mockRecorder;

    const result = await stopRecordingScreen.call(driver);

    assert.equal(result, '');
    assertNotCalled(mockUploadRecordedMedia);
  });

  it('passes remotePath and upload options to uploadRecordedMedia', async () => {
    const driver = createMockDriver() as any;
    const mockRecorder = {stop: mock.fn(async () => 'C:\\temp\\rec.mp4')};
    driver._screenRecorder = mockRecorder;

    await stopRecordingScreen.call(driver, {
      remotePath: 'https://example.com/upload',
      user: 'admin',
      pass: 'secret',
    });

    const [[path, remotePath, opts]] = calls(mockUploadRecordedMedia);
    assert.equal(path, 'C:\\temp\\rec.mp4');
    assert.equal(remotePath, 'https://example.com/upload');
    assert.partialDeepStrictEqual(opts, {user: 'admin', pass: 'secret'});
  });
});
