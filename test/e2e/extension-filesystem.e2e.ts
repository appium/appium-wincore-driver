import assert from 'node:assert/strict';
import {access, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import {createCalculatorSession, quitSession} from './helpers/session.js';

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

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

    beforeEach(async () => {
      testFilePath = join(tmpdir(), `appiumdesktop-test-${Date.now()}.txt`);
      await writeFile(testFilePath, 'test content');
    });

    afterEach(async () => {
      // Clean up if test didn't delete it
      await rm(testFilePath, {force: true});
    });

    it('deletes an existing temp file and the file no longer exists', async () => {
      assert.equal(await exists(testFilePath), true);
      await driver.executeScript('windows: deleteFile', [{path: testFilePath}]);
      assert.equal(await exists(testFilePath), false);
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

    afterEach(async () => {
      // Best-effort cleanup in case test failed
      await rm(testDirPath, {recursive: true, force: true});
    });

    it('deletes an existing empty temp directory', async () => {
      await mkdir(testDirPath);
      assert.equal(await exists(testDirPath), true);
      await driver.executeScript('windows: deleteFolder', [{path: testDirPath}]);
      assert.equal(await exists(testDirPath), false);
    });

    it('deletes a directory with files recursively (recursive: true, default)', async () => {
      await mkdir(testDirPath);
      await writeFile(join(testDirPath, 'file1.txt'), 'content');
      await writeFile(join(testDirPath, 'file2.txt'), 'content');
      await driver.executeScript('windows: deleteFolder', [{path: testDirPath, recursive: true}]);
      assert.equal(await exists(testDirPath), false);
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
