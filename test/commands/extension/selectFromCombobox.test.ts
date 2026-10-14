import {W3C_ELEMENT_KEY, errors} from 'appium/driver';
/**
 * Unit tests for `windows: selectFromCombobox`, run against a simulated dropdown: a list
 * of entries of which only a window is realized (virtualized) or all are (plain list),
 * scrolled by the mocked mouse wheel.
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';

import * as executeMethods from '../../../lib/commands/execute-methods';
import * as extension from '../../../lib/commands/extension';
import {selectFromCombobox} from '../../../lib/commands/extension';
import {createMockDriver, withExecuteMethodDispatch} from '../../fixtures/driver';

const list = vi.hoisted(() => ({
  names: [] as string[],
  top: 0,
  /** Entries realized at once; Infinity for a list that exposes every entry. */
  window: Infinity,
  scroll(ticks: number) {
    // Negative ticks scroll toward the end of the list, one entry per tick.
    const maxTop = Math.max(0, list.names.length - list.window);
    list.top = Math.min(maxTop, Math.max(0, list.top - ticks));
  },
}));

vi.mock('../../../lib/winapi/user32', () => ({
  keyDown: vi.fn(),
  keyUp: vi.fn(),
  mouseMoveAbsolute: vi.fn().mockResolvedValue(undefined),
  mouseScroll: vi.fn((_x: number, y: number) => list.scroll(y)),
  mouseDown: vi.fn(),
  mouseUp: vi.fn(),
  getCursorPos: vi.fn().mockReturnValue({x: 0, y: 0}),
}));

vi.mock('../../../lib/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/util')>()),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

const COMBO = 'combo';

type Options = {
  names: string[];
  window?: number;
  top?: number;
  /** Extra non-item descendants, by name (e.g. the combo's selection-box text). */
  texts?: string[];
  expandable?: boolean;
};

function createDropdownDriver({names, window = Infinity, top = 0, texts = [], expandable = true}: Options) {
  list.names = names;
  list.window = window;
  list.top = top;
  let expanded = false;
  const selected: string[] = [];

  const realized = () => (expanded || !expandable ? list.names.slice(list.top, list.top + list.window) : []);
  const itemIds = () => realized().map((name) => `item:${name}`);

  const driver = createMockDriver() as any;
  driver.sendCommand.mockImplementation(async (method: string, args: any) => {
    switch (method) {
      case 'expandElement':
        if (!expandable) {
          throw new errors.UnknownError('PatternNotSupported: Element does not support ExpandCollapsePattern.');
        }
        expanded = true;
        return null;
      case 'collapseElement':
        expanded = false;
        return null;
      case 'selectElement':
        selected.push(args.elementId);
        return null;
      case 'lookupElement':
        return true;
      case 'getRect':
        return {x: 0, y: 0, width: 10, height: 10};
      case 'findElements': {
        const {condition} = args;
        if (condition.type === 'property' && condition.property === 'Name') {
          const textIds = texts.filter((t) => t === condition.value).map((t) => `text:${t}`);
          return [...textIds, ...itemIds().filter((id) => id === `item:${condition.value}`)];
        }
        return itemIds();
      }
      case 'getProperty':
        if (args.elementId === COMBO) {
          if (args.property === 'ExpandCollapseState') {
            if (!expandable) {
              throw new errors.UnknownError('PatternNotSupported');
            }
            return expanded ? 'Expanded' : 'Collapsed';
          }
          if (args.property === 'ControlType') {
            return expandable ? 'ComboBox' : 'List';
          }
        }
        if (args.property === 'ControlType') {
          return args.elementId.startsWith('item:') ? 'ListItem' : 'Text';
        }
        if (args.property === 'Name') {
          return args.elementId.slice(args.elementId.indexOf(':') + 1);
        }
        return null;
      default:
        return null;
    }
  });
  return {driver, selected, isExpanded: () => expanded};
}

const NAMES = Array.from({length: 30}, (_, i) => `Option ${i + 1}`);

describe('windows: selectFromCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the combo box, selects the exact match and closes it again', async () => {
    const {driver, selected, isExpanded} = createDropdownDriver({names: NAMES});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 12'});
    expect(driver.sendCommand).toHaveBeenCalledWith('expandElement', {elementId: COMBO});
    expect(selected).toEqual(['item:Option 12']);
    expect(isExpanded()).toBe(false);
  });

  it('matches exactly, not by prefix', async () => {
    const {driver, selected} = createDropdownDriver({names: ['Option 1', 'Option 10']});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 1'});
    expect(selected).toEqual(['item:Option 1']);
  });

  it('prefers a list entry over other elements carrying the same text', async () => {
    const {driver, selected} = createDropdownDriver({names: NAMES, texts: ['Option 3']});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 3'});
    expect(selected).toEqual(['item:Option 3']);
  });

  it('scrolls a virtualized list down until the entry is realized', async () => {
    const {driver, selected} = createDropdownDriver({names: NAMES, window: 5});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 27'});
    expect(selected).toEqual(['item:Option 27']);
  });

  it('scrolls back up when the list opened below the entry', async () => {
    const {driver, selected} = createDropdownDriver({names: NAMES, window: 5, top: 15});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 2'});
    expect(selected).toEqual(['item:Option 2']);
  });

  it('throws NoSuchElementError at the end of the list and closes the popup', async () => {
    const {driver, selected, isExpanded} = createDropdownDriver({names: NAMES, window: 5});
    await expect(selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 99'})).rejects.toThrow(
      errors.NoSuchElementError,
    );
    expect(selected).toEqual([]);
    expect(isExpanded()).toBe(false);
  });

  it('does not scroll a list that exposes every entry more than once', async () => {
    const {driver} = createDropdownDriver({names: NAMES});
    await expect(selectFromCombobox.call(driver, {elementId: COMBO, value: 'Missing'})).rejects.toThrow(
      errors.NoSuchElementError,
    );
    // One tick down and one up, each leaving the entries unchanged.
    const user32 = await import('../../../lib/winapi/user32');
    expect(user32.mouseScroll).toHaveBeenCalledTimes(2);
  });

  it('searches a container that cannot be expanded (list box) as it is', async () => {
    const {driver, selected} = createDropdownDriver({names: NAMES, expandable: false});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 5'});
    expect(selected).toEqual(['item:Option 5']);
  });

  it('rejects a call without a value', async () => {
    const {driver} = createDropdownDriver({names: NAMES});
    await expect(selectFromCombobox.call(driver, {elementId: COMBO} as any)).rejects.toThrow(
      errors.InvalidArgumentError,
    );
  });

  it('accepts both { elementId, value } and (element, value) through execute', async () => {
    for (const args of [[{elementId: COMBO, value: 'Option 4'}], [{[W3C_ELEMENT_KEY]: COMBO}, 'Option 4']]) {
      const {driver, selected} = createDropdownDriver({names: NAMES});
      withExecuteMethodDispatch(driver);
      Object.assign(driver, extension, executeMethods);
      await extension.execute.call(driver, 'windows: selectFromCombobox', args);
      expect(selected).toEqual(['item:Option 4']);
    }
  });
});
