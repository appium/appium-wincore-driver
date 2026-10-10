/**
 * Unit tests for startRecordingScreen extension command.
 */
import assert from 'node:assert/strict';
import {beforeEach, describe, it, mock} from 'node:test';

import {createMockDriver} from '../../fixtures/driver.js';
import {
  assertCalled,
  assertCalledTimes,
  assertCalledWith,
  assertNotCalled,
  calls,
  clearCalls,
} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

const MockScreenRecorder = mock.fn();

mockUser32(createUser32Mock());
mock.module('../../../lib/commands/screen-recorder.js', {
  exports: {
    ScreenRecorder: MockScreenRecorder,
    DEFAULT_EXT: 'mp4',
    uploadRecordedMedia: mock.fn(),
  },
});
const {startRecordingScreen} = await import('../../../lib/commands/extension.js');

describe('startRecordingScreen', () => {
  let mockRecorderInstance: {
    isRunning: any;
    start: any;
    stop: any;
  };

  beforeEach(() => {
    clearCalls(MockScreenRecorder);
    mockRecorderInstance = {
      isRunning: mock.fn(() => false),
      start: mock.fn(async () => undefined),
      stop: mock.fn(async () => ''),
    };
    MockScreenRecorder.mock.mockImplementation(function () {
      return mockRecorderInstance as any;
    });
  });

  it('creates a ScreenRecorder and starts recording', async () => {
    const driver = createMockDriver() as any;
    driver._screenRecorder = null;

    await startRecordingScreen.call(driver, {outputPath: 'C:\\temp\\rec.mp4'});

    const [[path, recorderDriver, opts]] = calls(MockScreenRecorder);
    assert.equal(path, 'C:\\temp\\rec.mp4');
    assert.equal(recorderDriver, driver);
    assert.equal(typeof opts, 'object');
    assert.notEqual(opts, null);
    assertCalledTimes(mockRecorderInstance.start, 1);
    assert.equal(driver._screenRecorder, mockRecorderInstance);
  });

  it('passes options to ScreenRecorder', async () => {
    const driver = createMockDriver() as any;
    driver._screenRecorder = null;

    await startRecordingScreen.call(driver, {
      outputPath: 'C:\\rec.mp4',
      timeLimit: 60,
      videoFps: 30,
      preset: 'ultrafast',
      captureCursor: true,
      captureClicks: true,
      audioInput: 'Microphone',
      videoFilter: 'scale=1280:-2',
    });

    const [[path, recorderDriver, opts]] = calls(MockScreenRecorder);
    assert.equal(path, 'C:\\rec.mp4');
    assert.equal(recorderDriver, driver);
    assert.partialDeepStrictEqual(opts, {
      fps: 30,
      timeLimit: 60,
      preset: 'ultrafast',
      captureCursor: true,
      captureClicks: true,
      audioInput: 'Microphone',
      videoFilter: 'scale=1280:-2',
    });
  });

  it('does nothing when already recording and forceRestart=false', async () => {
    const driver = createMockDriver() as any;
    const existingRecorder = {
      isRunning: mock.fn(() => true),
      stop: mock.fn(),
    };
    driver._screenRecorder = existingRecorder;

    await startRecordingScreen.call(driver, {forceRestart: false});

    assertNotCalled(existingRecorder.stop);
    assertNotCalled(MockScreenRecorder);
  });

  it('force-stops existing recording when forceRestart=true (default)', async () => {
    const driver = createMockDriver() as any;
    const existingRecorder = {
      isRunning: mock.fn(() => true),
      stop: mock.fn(async () => ''),
    };
    driver._screenRecorder = existingRecorder;

    await startRecordingScreen.call(driver, {outputPath: 'C:\\new.mp4'});

    assertCalledWith(existingRecorder.stop, true);
    assertCalled(MockScreenRecorder);
    assertCalled(mockRecorderInstance.start);
  });

  it('clears _screenRecorder if start() throws', async () => {
    const driver = createMockDriver() as any;
    driver._screenRecorder = null;
    mockRecorderInstance.start.mock.mockImplementation(async () => {
      throw new Error('ffmpeg failed');
    });

    await assert.rejects(startRecordingScreen.call(driver, {outputPath: 'C:\\out.mp4'}), /ffmpeg failed/);

    assert.equal(driver._screenRecorder, null);
  });
});
