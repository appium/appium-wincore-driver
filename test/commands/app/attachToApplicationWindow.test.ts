/**
 * Unit tests for attachToApplicationWindow / attachToWindowHandles window selection
 * when the launched process tree owns more than one top-level window.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import {
    attachToApplicationWindow,
    attachToWindowHandles,
    changeRootElement,
    waitForMainWindow,
} from '../../../lib/commands/app';
import { createMockDriver } from '../../fixtures/driver';

const mockGetWindowAllHandlesForProcessIds = vi.fn();

vi.mock('../../../lib/winapi/user32', () => ({
    getAllWindowHandles: vi.fn().mockReturnValue([]),
    getWindowAllHandlesForProcessIds: (...args: unknown[]) => mockGetWindowAllHandlesForProcessIds(...args),
    isIEWindowHwnd: vi.fn().mockReturnValue(false),
    trySetForegroundWindow: vi.fn().mockResolvedValue(true),
}));

const MAIN = 0x100;
const PALETTE = 0x200;

/**
 * Mock driver whose process tree owns the given windows, each with the given number of
 * keyboard-focusable descendants. Element ids are `el-<hwnd>`.
 */
function createDriver(focusablesByHandle: Record<number, number>) {
    const driver = createMockDriver() as any;
    driver.attachToWindowHandles = vi.fn(attachToWindowHandles);
    driver.focusElement = vi.fn().mockResolvedValue(undefined);
    let rootId = '';
    driver.sendCommand.mockImplementation(async (method: string, args: any) => {
        switch (method) {
            case 'getChildProcessIds': return [];
            case 'elementFromHandle': return `el-${args.handle}`;
            case 'setRootElementFromElementId': rootId = args.elementId; return null;
            case 'checkRootElementNotNull': return true;
            case 'saveRootElementToTable': return rootId;
            case 'getProperty':
                if (args.property === 'ClassName') {return 'Window';}
                if (args.property === 'NativeWindowHandle') {return args.elementId.slice(3);}
                return null;
            case 'findElements': {
                const hwnd = Number(args.contextElementId.slice(3));
                return Array.from({ length: focusablesByHandle[hwnd] ?? 0 }, (_, i) => `f${i}`);
            }
            default: return null;
        }
    });
    return driver;
}

function rootsSet(driver: any): string[] {
    return driver.sendCommand.mock.calls
        .filter(([m]: [string]) => m === 'setRootElementFromElementId')
        .map(([, args]: [string, any]) => args.elementId);
}

describe('attachToApplicationWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('attaches to the window with focusable content even when an auxiliary window is last in z-order', async () => {
        // Notepad: main window on top, its empty "Command Palette" window below it.
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([MAIN, PALETTE]);
        const driver = createDriver({ [MAIN]: 40, [PALETTE]: 0 });

        const result = await attachToApplicationWindow.call(driver, 1234);

        expect(result.focused).toBe(true);
        expect(rootsSet(driver)).toEqual([`el-${MAIN}`]);
    });

    it('falls back to the last window and flags a splash screen when no window has focusable content', async () => {
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([MAIN, PALETTE]);
        const driver = createDriver({ [MAIN]: 1, [PALETTE]: 0 });

        const result = await attachToApplicationWindow.call(driver, 1234);

        expect(result.focused).toBe(false);
        expect(rootsSet(driver)).toEqual([`el-${PALETTE}`]);
    });

    it('skips the multi-window scan when the process has a single window', async () => {
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([MAIN]);
        const driver = createDriver({ [MAIN]: 40 });

        const result = await attachToApplicationWindow.call(driver, 1234);

        expect(result.focused).toBe(true);
        expect(driver.attachToWindowHandles).not.toHaveBeenCalled();
        expect(rootsSet(driver)).toEqual([`el-${MAIN}`]);
    });
});

describe('attachToWindowHandles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to the first valid window when none has focusable content', async () => {
        const driver = createDriver({ [MAIN]: 0, [PALETTE]: 0 });

        await expect(attachToWindowHandles.call(driver, [MAIN, PALETTE])).resolves.toBe(true);
        expect(rootsSet(driver)).toEqual([`el-${MAIN}`]);
    });

    it('with requireFocusable, returns false and leaves the root alone when none has focusable content', async () => {
        const driver = createDriver({ [MAIN]: 0, [PALETTE]: 0 });

        await expect(attachToWindowHandles.call(driver, [MAIN, PALETTE], { requireFocusable: true })).resolves.toBe(false);
        expect(rootsSet(driver)).toEqual([]);
    });
});

describe('waitForMainWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('attaches to a window that gains focusable content while the splash is still open', async () => {
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([MAIN, PALETTE]);
        const focusables: Record<number, number> = { [MAIN]: 0, [PALETTE]: 0 };
        const driver = createDriver(focusables);
        driver.attachToApplicationWindow = vi.fn();
        await driver.sendCommand('setRootElementFromElementId', { elementId: `el-${PALETTE}` });
        // Main window's UIA tree finishes loading after the first poll.
        driver.attachToWindowHandles.mockImplementationOnce(async function (this: any, ...args: any[]) {
            const attached = await attachToWindowHandles.apply(this, args as any);
            focusables[MAIN] = 40;
            return attached;
        });

        await waitForMainWindow.call(driver, [1234], performance.now() + 5_000);

        expect(rootsSet(driver).at(-1)).toBe(`el-${MAIN}`);
        expect(driver.attachToWindowHandles).toHaveBeenCalledTimes(2);
        expect(driver.attachToApplicationWindow).not.toHaveBeenCalled();
    });

    it('re-attaches via attachToApplicationWindow once the splash closes', async () => {
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([PALETTE]);
        const driver = createDriver({ [PALETTE]: 0 });
        driver.attachToApplicationWindow = vi.fn().mockResolvedValue({ focused: true, knownPids: [1234] });
        const send = driver.sendCommand.getMockImplementation();
        driver.sendCommand.mockImplementation(async (method: string, args: any) =>
            method === 'checkRootElementNotNull' ? false : send(method, args));

        await waitForMainWindow.call(driver, [1234], performance.now() + 5_000);

        expect(driver.sendCommand).toHaveBeenCalledWith('setRootElementNull', {});
        expect(driver.attachToApplicationWindow).toHaveBeenCalledWith(1234, expect.anything());
    });

    it('gives up at the deadline and stays on the splash when nothing qualifies', async () => {
        mockGetWindowAllHandlesForProcessIds.mockReturnValue([PALETTE]);
        const driver = createDriver({ [PALETTE]: 0 });
        driver.attachToApplicationWindow = vi.fn();
        await driver.sendCommand('setRootElementFromElementId', { elementId: `el-${PALETTE}` });

        await waitForMainWindow.call(driver, [1234], performance.now() + 500);

        expect(rootsSet(driver)).toEqual([`el-${PALETTE}`]);
        expect(driver.log.warn).toHaveBeenCalledWith(expect.stringContaining('Deadline reached'));
    });
});

describe('changeRootElement splash handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createLaunchDriver(caps: Record<string, unknown>) {
        const driver = createMockDriver() as any;
        driver.caps = caps;
        driver.sendCommand.mockImplementation(async (method: string) => (method === 'startProcess' ? 1234 : null));
        driver.attachToApplicationWindow = vi.fn().mockResolvedValue({ focused: false, knownPids: [1234, 5678] });
        driver.waitForMainWindow = vi.fn().mockResolvedValue(undefined);
        return driver;
    }

    it('waits for the main window with a default deadline when ms:waitForAppLaunch is unset', async () => {
        const driver = createLaunchDriver({});
        const before = performance.now();

        await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

        expect(driver.waitForMainWindow).toHaveBeenCalledTimes(1);
        const [pids, deadline] = driver.waitForMainWindow.mock.calls[0];
        expect(pids).toEqual([1234, 5678]);
        expect(deadline).toBeGreaterThan(before);
        expect(deadline).toBeLessThanOrEqual(performance.now() + 5_000);
    });

    it('uses ms:waitForAppLaunch as the splash deadline when set', async () => {
        const driver = createLaunchDriver({ 'ms:waitForAppLaunch': 30 });
        const before = performance.now();

        await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

        const [, deadline] = driver.waitForMainWindow.mock.calls[0];
        expect(deadline).toBeGreaterThan(before + 20_000);
    });

    it('does not wait when the attached window is not a splash', async () => {
        const driver = createLaunchDriver({});
        driver.attachToApplicationWindow.mockResolvedValue({ focused: true, knownPids: [1234] });

        await changeRootElement.call(driver, 'C:\\Windows\\notepad.exe');

        expect(driver.waitForMainWindow).not.toHaveBeenCalled();
    });
});
