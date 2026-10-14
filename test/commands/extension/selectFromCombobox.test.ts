import {W3C_ELEMENT_KEY, errors} from 'appium/driver';
/**
 * Unit tests for `windows: selectFromCombobox`, run against a simulated dropdown: a list
 * of entries of which only the first few are realized (virtualized) or all are (plain
 * list), optionally with UIA ItemContainerPattern on the server side.
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';

import * as executeMethods from '../../../lib/commands/execute-methods';
import * as extension from '../../../lib/commands/extension';
import {selectFromCombobox} from '../../../lib/commands/extension';
import type * as UtilModule from '../../../lib/util';
import {createMockDriver, withExecuteMethodDispatch} from '../../fixtures/driver';

vi.mock('../../../lib/util', async (importOriginal) => ({
  ...(await importOriginal<typeof UtilModule>()),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

const COMBO = 'combo';

type Options = {
  names: string[];
  /** Entries realized while open; Infinity for a list that exposes every entry. */
  window?: number;
  /** Extra non-item descendants, by name (e.g. the combo's selection-box text). */
  texts?: string[];
  expandable?: boolean;
  /**
   * The combo looks entries up itself (ItemContainerPattern, or a tree provider's
   * FindItemInContainer) and finds any entry, realized or not. 'unsupported' answers
   * like a tree provider that does not implement it.
   */
  itemContainer?: boolean | 'unsupported';
};

function createDropdownDriver({
  names,
  window = Infinity,
  texts = [],
  expandable = true,
  itemContainer = false,
}: Options) {
  let expanded = false;
  const selected: string[] = [];

  const itemIds = () => (expanded || !expandable ? names.slice(0, window) : []).map((name) => `item:${name}`);

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
      case 'findItemInContainer':
        if (itemContainer === 'unsupported') {
          throw new errors.UnknownError(
            "PatternNotSupported: The 'fake' tree provider does not support FindItemInContainer.",
          );
        }
        return itemContainer && names.includes(args.name) ? `item:${args.name}` : null;
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

  it('finds an entry a virtualized list has not realized through ItemContainerPattern', async () => {
    const {driver, selected, isExpanded} = createDropdownDriver({names: NAMES, window: 5, itemContainer: true});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 29'});
    expect(driver.sendCommand).toHaveBeenCalledWith('findItemInContainer', {elementId: COMBO, name: 'Option 29'});
    expect(selected).toEqual(['item:Option 29']);
    expect(isExpanded()).toBe(false);
  });

  it('searches the descendants when the container cannot look entries up itself', async () => {
    const {driver, selected} = createDropdownDriver({names: NAMES, itemContainer: 'unsupported'});
    await selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 12'});
    expect(selected).toEqual(['item:Option 12']);
  });

  it('does not swallow other lookup errors', async () => {
    const {driver} = createDropdownDriver({names: NAMES});
    const send = driver.sendCommand.getMockImplementation();
    driver.sendCommand.mockImplementation(async (method: string, args: any) => {
      if (method === 'findItemInContainer') {
        throw new errors.NoSuchElementError('ElementNotFound: stale container');
      }
      return send(method, args);
    });
    await expect(selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 12'})).rejects.toThrow(
      errors.NoSuchElementError,
    );
  });

  it('throws NoSuchElementError for a missing entry and closes the popup', async () => {
    for (const itemContainer of [true, false]) {
      const {driver, selected, isExpanded} = createDropdownDriver({names: NAMES, itemContainer});
      await expect(selectFromCombobox.call(driver, {elementId: COMBO, value: 'Option 99'})).rejects.toThrow(
        errors.NoSuchElementError,
      );
      expect(selected).toEqual([]);
      expect(isExpanded()).toBe(false);
    }
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
