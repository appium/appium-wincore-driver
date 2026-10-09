import assert from 'node:assert/strict';
import {existsSync, mkdirSync, writeFileSync, rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession} from './helpers/session.js';

describe('windows: deleteFile and deleteFolder', () => {
  let driver: Browser;

  before(async () => {
    driver = await createCalculatorSession();
  });

  after(async () => {
    await quitSession(driver);
  });

  describe('windows: deleteFile', () => {
    let testFilePath: string;

    beforeEach(() => {
      testFilePath = join(tmpdir(), `appiumdesktop-test-${Date.now()}.txt`);
      writeFileSync(testFilePath, 'test content');
    });

    afterEach(() => {
      if (existsSync(testFilePath)) {
        // Clean up if test didn't delete it
        try {
          rmdirSync(testFilePath);
        } catch {
          // file not a dir
        }
      }
    });

    it('deletes an existing temp file and the file no longer exists', async () => {
      assert.equal(existsSync(testFilePath), true);
      await driver.executeScript('windows: deleteFile', [{path: testFilePath}]);
      assert.equal(existsSync(testFilePath), false);
    });

    it('throws when the file does not exist', async () => {
      const nonExistent = join(tmpdir(), 'appiumdesktop-nonexistent-xyz.txt');
      await assert.rejects(driver.executeScript('windows: deleteFile', [{path: nonExistent}]));
    });

    it('throws when path is not provided', async () => {
      await assert.rejects(driver.executeScript('windows: deleteFile', [{}]));
    });
  });

  describe('windows: deleteFolder', () => {
    let testDirPath: string;

    beforeEach(() => {
      testDirPath = join(tmpdir(), `appiumdesktop-dir-${Date.now()}`);
    });

    afterEach(() => {
      // Best-effort cleanup in case test failed
      if (existsSync(testDirPath)) {
        try {
          rmdirSync(testDirPath, {recursive: true});
        } catch {
          // noop
        }
      }
    });

    it('deletes an existing empty temp directory', async () => {
      mkdirSync(testDirPath);
      assert.equal(existsSync(testDirPath), true);
      await driver.executeScript('windows: deleteFolder', [{path: testDirPath}]);
      assert.equal(existsSync(testDirPath), false);
    });

    it('deletes a directory with files recursively (recursive: true, default)', async () => {
      mkdirSync(testDirPath);
      writeFileSync(join(testDirPath, 'file1.txt'), 'content');
      writeFileSync(join(testDirPath, 'file2.txt'), 'content');
      await driver.executeScript('windows: deleteFolder', [{path: testDirPath, recursive: true}]);
      assert.equal(existsSync(testDirPath), false);
    });

    it('throws when the folder does not exist', async () => {
      const nonExistent = join(tmpdir(), 'appiumdesktop-nonexistent-dir-xyz');
      await assert.rejects(driver.executeScript('windows: deleteFolder', [{path: nonExistent}]));
    });

    it('throws when path is not provided', async () => {
      await assert.rejects(driver.executeScript('windows: deleteFolder', [{}]));
    });
  });
});
