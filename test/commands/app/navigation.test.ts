/**
 * Unit tests for lib/commands/app.ts: back, forward, getTitle, setWindowRect
 */
import {errors} from 'appium/driver';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {back, forward, title, setWindowRect} from '../../../lib/commands/app';
import {Key} from '../../../lib/enums';
import {createMockDriver} from '../../fixtures/driver';

vi.mock('../../../lib/winapi/user32', () => ({
  getWindowAllHandlesForProcessIds: vi.fn().mockReturnValue([]),
  trySetForegroundWindow: vi.fn().mockReturnValue(true),
  keyDown: vi.fn(),
  keyUp: vi.fn(),
}));

const ELEMENT_ID = '1.2.3.4.5';

describe('back', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends Alt+Left when a window is active', async () => {
    const {keyDown, keyUp} = await import('../../../lib/winapi/user32');
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue(ELEMENT_ID);

    await back.call(driver);

    expect(keyDown).toHaveBeenNthCalledWith(1, Key.ALT);
    expect(keyDown).toHaveBeenNthCalledWith(2, Key.LEFT);
    expect(keyUp).toHaveBeenNthCalledWith(1, Key.LEFT);
    expect(keyUp).toHaveBeenNthCalledWith(2, Key.ALT);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('');

    await expect(back.call(driver)).rejects.toThrow('No active window found');
  });

  it('performs exactly one sendCommand call (window check) before sending keys', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue(ELEMENT_ID);

    await back.call(driver);

    expect(driver.sendCommand).toHaveBeenCalledTimes(1);
    expect(driver.sendCommand).toHaveBeenCalledWith('saveRootElementToTable', {});
  });
});

describe('forward', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends Alt+Right when a window is active', async () => {
    const {keyDown, keyUp} = await import('../../../lib/winapi/user32');
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue(ELEMENT_ID);

    await forward.call(driver);

    expect(keyDown).toHaveBeenNthCalledWith(1, Key.ALT);
    expect(keyDown).toHaveBeenNthCalledWith(2, Key.RIGHT);
    expect(keyUp).toHaveBeenNthCalledWith(1, Key.RIGHT);
    expect(keyUp).toHaveBeenNthCalledWith(2, Key.ALT);
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('');

    await expect(forward.call(driver)).rejects.toThrow('No active window found');
  });
});

describe('title (getTitle)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the window title from the Name property', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce(ELEMENT_ID).mockResolvedValueOnce('Untitled - Notepad');

    const result = await title.call(driver);

    expect(result).toBe('Untitled - Notepad');
    expect(driver.sendCommand).toHaveBeenCalledTimes(2);
    expect(driver.sendCommand).toHaveBeenNthCalledWith(1, 'saveRootElementToTable', {});
    expect(driver.sendCommand).toHaveBeenNthCalledWith(2, 'getProperty', {elementId: ELEMENT_ID, property: 'Name'});
  });

  it('returns an empty string when the window has no title', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValueOnce(ELEMENT_ID).mockResolvedValueOnce('');

    const result = await title.call(driver);

    expect(result).toBe('');
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('');

    await expect(title.call(driver)).rejects.toThrow('No active window found');
  });
});

describe('setWindowRect', () => {
  beforeEach(() => vi.clearAllMocks());

  const MOCK_RECT = {x: 100, y: 100, width: 800, height: 600};

  function createDriverWithRect(windowRect = MOCK_RECT) {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue(ELEMENT_ID);
    driver.getWindowRect = vi.fn().mockResolvedValue(windowRect);
    return driver;
  }

  it('calls saveRoot + restore + move + resize when all four values provided', async () => {
    const driver = createDriverWithRect();

    const result = await setWindowRect.call(driver, 100, 100, 800, 600);

    expect(driver.sendCommand).toHaveBeenCalledWith('saveRootElementToTable', {});
    expect(driver.sendCommand).toHaveBeenCalledWith('restoreWindow', {elementId: ELEMENT_ID});
    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 100, y: 100});
    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 800, height: 600});
    expect(driver.getWindowRect).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_RECT);
  });

  it('calls only saveRoot + restore + move when width and height are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, 50, 75, null, null);

    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 50, y: 75});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('resizeWindow', expect.anything());
  });

  it('calls only saveRoot + restore + resize when x and y are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, null, null, 1024, 768);

    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 1024, height: 768});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('moveWindow', expect.anything());
  });

  // The protocol layer passes fields that are missing from the request body as `undefined`,
  // so `{"x": 700, "y": 300}` arrives as (700, 300, undefined, undefined).
  it('only moves when width and height are omitted from the request', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, 700, 300, undefined, undefined);

    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 700, y: 300});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('resizeWindow', expect.anything());
  });

  it('only resizes when x and y are omitted from the request', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, undefined, undefined, 1024, 768);

    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 1024, height: 768});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('moveWindow', expect.anything());
  });

  it('skips move and resize when every field is omitted from the request', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, undefined, undefined, undefined, undefined);

    expect(driver.sendCommand).not.toHaveBeenCalledWith('moveWindow', expect.anything());
    expect(driver.sendCommand).not.toHaveBeenCalledWith('resizeWindow', expect.anything());
  });

  // W3C applies each value on its own, so a value missing from a pair keeps the current one.
  it('moves only along x when y is omitted, keeping the current y', async () => {
    const driver = createDriverWithRect({x: 10, y: 20, width: 800, height: 600});

    await setWindowRect.call(driver, 0, undefined, undefined, undefined);

    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 0, y: 20});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('resizeWindow', expect.anything());
  });

  it('changes only the height when width is omitted, keeping the current width', async () => {
    const driver = createDriverWithRect({x: 10, y: 20, width: 800, height: 600});

    await setWindowRect.call(driver, undefined, undefined, undefined, 400);

    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 800, height: 400});
    expect(driver.sendCommand).not.toHaveBeenCalledWith('moveWindow', expect.anything());
  });

  it('applies x and width while keeping the current y and height', async () => {
    const driver = createDriverWithRect({x: 10, y: 20, width: 800, height: 600});

    await setWindowRect.call(driver, 50, null, 1024, null);

    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 50, y: 20});
    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 1024, height: 600});
  });

  it('sets the size before the position, in the order W3C lists them', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, 10, 20, 800, 600);

    const commands = driver.sendCommand.mock.calls.map(([command]: [string]) => command);
    expect(commands.indexOf('resizeWindow')).toBeLessThan(commands.indexOf('moveWindow'));
  });

  it('reads the current rect after restoring the window, not before', async () => {
    const driver = createDriverWithRect();
    const calls: string[] = [];
    driver.sendCommand.mockImplementation(async (command: string) => {
      calls.push(command);
      return ELEMENT_ID;
    });
    driver.getWindowRect.mockImplementation(async () => {
      calls.push('getWindowRect');
      return MOCK_RECT;
    });

    await setWindowRect.call(driver, 5, undefined, undefined, undefined);

    expect(calls.slice(0, 4)).toEqual(['saveRootElementToTable', 'restoreWindow', 'getWindowRect', 'moveWindow']);
  });

  it('skips move and resize when all arguments are null', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, null, null, null, null);

    expect(driver.sendCommand).not.toHaveBeenCalledWith('moveWindow', expect.anything());
    expect(driver.sendCommand).not.toHaveBeenCalledWith('resizeWindow', expect.anything());
  });

  it('returns the new window rect from getWindowRect', async () => {
    const expectedRect = {x: 200, y: 300, width: 1024, height: 768};
    const driver = createDriverWithRect(expectedRect);

    const result = await setWindowRect.call(driver, 200, 300, 1024, 768);

    expect(result).toEqual(expectedRect);
  });

  it('throws InvalidArgumentError for negative width', async () => {
    const driver = createDriverWithRect();

    await expect(setWindowRect.call(driver, 0, 0, -1, 600)).rejects.toThrow('width must be a non-negative integer');
  });

  it('throws InvalidArgumentError for negative height', async () => {
    const driver = createDriverWithRect();

    await expect(setWindowRect.call(driver, 0, 0, 800, -1)).rejects.toThrow('height must be a non-negative integer');
  });

  it.each([
    ['a string x', ['a', 10, null, null], 'x must be an integer'],
    ['a boolean y', [10, true, null, null], 'y must be an integer'],
    ['a NaN width', [null, null, Number.NaN, 600], 'width must be a non-negative integer'],
    ['an infinite height', [null, null, 800, Number.POSITIVE_INFINITY], 'height must be a non-negative integer'],
    ['an x beyond 2^31 - 1', [2 ** 31, 0, null, null], 'x must be an integer'],
    ['an x that rounds up to 2^31', [2 ** 31 - 0.5, 0, null, null], 'x must be an integer'],
    ['a y below -(2^31)', [0, -(2 ** 31) - 1, null, null], 'y must be an integer'],
  ])('rejects %s with InvalidArgumentError before touching the window', async (_name, args, message) => {
    const driver = createDriverWithRect();

    const err = await setWindowRect.call(driver, ...(args as [any, any, any, any])).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(errors.InvalidArgumentError);
    expect((err as Error).message).toContain(message);
    expect(driver.sendCommand).not.toHaveBeenCalled();
  });

  it('rounds fractional values to the integers WincoreServer expects', async () => {
    const driver = createDriverWithRect();

    await setWindowRect.call(driver, 10.4, 20.6, 800.5, 600.2);

    expect(driver.sendCommand).toHaveBeenCalledWith('moveWindow', {elementId: ELEMENT_ID, x: 10, y: 21});
    expect(driver.sendCommand).toHaveBeenCalledWith('resizeWindow', {elementId: ELEMENT_ID, width: 801, height: 600});
  });

  it('throws NoSuchWindowError when no active window', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mockResolvedValue('');
    driver.getWindowRect = vi.fn();

    await expect(setWindowRect.call(driver, 0, 0, 800, 600)).rejects.toThrow('No active window found');
  });
});
