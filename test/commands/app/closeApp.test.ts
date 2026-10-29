/**
 * Unit tests for the W3C closeApp command (session-scoped).
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {closeApp} from '../../../lib/commands/app';
import {createMockDriver} from '../../fixtures/driver';

const mockGetAllWindowHandles = vi.fn();

vi.mock('../../../lib/winapi/user32', () => ({
  getAllWindowHandles: (...args: unknown[]) => mockGetAllWindowHandles(...args),
  getWindowAllHandlesForProcessIds: vi.fn().mockReturnValue([]),
  isIEWindowHwnd: vi.fn().mockReturnValue(false),
  trySetForegroundWindow: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../lib/util', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe('closeApp (W3C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllWindowHandles.mockReturnValue([]);
  });

  it('closes the session app window via C# server commands', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand
      .mockResolvedValueOnce('element-123')
      .mockResolvedValueOnce('4660')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await closeApp.call(driver);

    expect(driver.sendCommand).toHaveBeenCalledTimes(4);
    expect(driver.sendCommand).toHaveBeenNthCalledWith(1, 'saveRootElementToTable', {});
    expect(driver.sendCommand).toHaveBeenNthCalledWith(2, 'getProperty', {
      elementId: 'element-123',
      property: 'NativeWindowHandle',
    });
    expect(driver.sendCommand).toHaveBeenNthCalledWith(3, 'closeWindow', {elementId: 'element-123'});
    expect(driver.sendCommand).toHaveBeenNthCalledWith(4, 'setRootElementNull', {});
  });

  it('waits until the closed window is no longer listed', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce('element-123').mockResolvedValueOnce('4660');
    mockGetAllWindowHandles.mockReturnValueOnce([4660, 1]).mockReturnValueOnce([4660, 1]).mockReturnValueOnce([1]);

    await closeApp.call(driver);

    expect(mockGetAllWindowHandles).toHaveBeenCalledTimes(3);
    expect(driver.log.warn).not.toHaveBeenCalled();
  });

  it('gives up with a warning when the window stays open', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce('element-123').mockResolvedValueOnce('4660');
    mockGetAllWindowHandles.mockReturnValue([4660]);

    await closeApp.call(driver);

    expect(driver.log.warn).toHaveBeenCalledWith(expect.stringContaining('0x00001234'));
  });

  it('does not wait when the root has no native window handle', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce('element-123').mockResolvedValueOnce('0');

    await closeApp.call(driver);

    expect(mockGetAllWindowHandles).not.toHaveBeenCalled();
  });

  it('throws NoSuchWindowError when root element is empty string', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce('');

    await expect(closeApp.call(driver)).rejects.toThrow('No active app window');
  });

  it('throws NoSuchWindowError when root element is null', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce(null);

    await expect(closeApp.call(driver)).rejects.toThrow('No active app window');
  });
});
