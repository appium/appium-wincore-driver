/**
 * Unit tests for pattern extension commands (invoke, expand, collapse, close, etc.).
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {W3C_ELEMENT_KEY, errors} from 'appium/driver.js';

import {createMockDriver, MOCK_ELEMENT} from '../../fixtures/driver.js';
import {mockCommonModules} from '../../helpers/common.js';
import {assertCalledWith, calls, queueRejected} from '../../helpers/mock.js';
import {createUser32Mock, mockUser32} from '../../helpers/user32.js';

mockUser32(createUser32Mock());
await mockCommonModules();
const {
  patternInvoke,
  patternExpand,
  patternCollapse,
  patternScrollIntoView,
  patternClose,
  patternMaximize,
  patternMinimize,
  patternRestore,
  patternIsMultiple,
  patternGetSelectedItem,
  patternGetAllSelectedItems,
  patternAddToSelection,
  patternRemoveFromSelection,
  patternSelect,
  patternToggle,
  patternSetValue,
  patternGetValue,
  focusElement,
} = await import('../../../lib/commands/extension.js');

const ELEMENT_ID = MOCK_ELEMENT[W3C_ELEMENT_KEY];

const PATTERN_COMMANDS = [
  {name: 'patternInvoke', fn: patternInvoke, expectedMethod: 'invokeElement'},
  {name: 'patternCollapse', fn: patternCollapse, expectedMethod: 'collapseElement'},
  {name: 'patternScrollIntoView', fn: patternScrollIntoView, expectedMethod: 'scrollElementIntoView'},
  {name: 'patternClose', fn: patternClose, expectedMethod: 'closeWindow'},
  {name: 'patternMaximize', fn: patternMaximize, expectedMethod: 'maximizeWindow'},
  {name: 'patternMinimize', fn: patternMinimize, expectedMethod: 'minimizeWindow'},
  {name: 'patternRestore', fn: patternRestore, expectedMethod: 'restoreWindow'},
  {name: 'patternAddToSelection', fn: patternAddToSelection, expectedMethod: 'addToSelection'},
  {name: 'patternRemoveFromSelection', fn: patternRemoveFromSelection, expectedMethod: 'removeFromSelection'},
  {name: 'patternSelect', fn: patternSelect, expectedMethod: 'selectElement'},
  {name: 'patternToggle', fn: patternToggle, expectedMethod: 'toggleElement'},
] as const;

// Original `assertNotCalledWith(..., 'setFocus', anything)`: no setFocus call carrying an argument.
const assertNoSetFocus = (fn: any) =>
  assert.ok(!calls(fn).some(([method, arg]) => method === 'setFocus' && arg != null), 'unexpected setFocus call');

describe('pattern commands', () => {
  for (const {name, fn, expectedMethod} of PATTERN_COMMANDS) {
    it(`${name} sends sendCommand with element id and correct method`, async () => {
      const driver = createMockDriver() as any;
      await fn.call(driver, MOCK_ELEMENT);
      assertCalledWith(driver.sendCommand, expectedMethod, {elementId: ELEMENT_ID});
    });
  }

  it('patternExpand trusts expandElement when ExpandCollapseState confirms Expanded', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'expandElement') {
        return null;
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Expanded';
      }
      return null;
    });
    await patternExpand.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'expandElement', {elementId: ELEMENT_ID});
    assertNoSetFocus(driver.sendCommand);
  });

  it('patternExpand falls back to ALT+Down for a ComboBox when expandElement throws', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'expandElement') {
        throw new Error('does not support ExpandCollapsePattern');
      }
      if (method === 'getProperty' && args.property === 'ControlType') {
        return 'ComboBox';
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Expanded';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    await patternExpand.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  it('patternExpand falls back to ALT+Down when expandElement succeeds but state never confirms', async () => {
    const driver = createMockDriver() as any;
    let expanded = false;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'expandElement') {
        return null;
      }
      if (method === 'setFocus') {
        expanded = true;
        return null;
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return expanded ? 'Expanded' : 'Collapsed';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    await patternExpand.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  it('patternExpand falls back to a real click when SetFocus does not confirm keyboard focus', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'expandElement') {
        throw new Error('does not support ExpandCollapsePattern');
      }
      if (method === 'getProperty' && args.property === 'ControlType') {
        return 'ComboBox';
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Expanded';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return false;
      }
      if (method === 'getProperty' && args.property === 'ClickablePoint') {
        return {x: 10, y: 20};
      }
      return null;
    });
    await patternExpand.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
    assertCalledWith(driver.sendCommand, 'getProperty', {elementId: ELEMENT_ID, property: 'ClickablePoint'});
  });

  it('patternExpand resolves without throwing when native and ALT+Down both fail to confirm expansion', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Collapsed';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    assert.equal(await patternExpand.call(driver, MOCK_ELEMENT), undefined);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  it('patternCollapse trusts collapseElement when ExpandCollapseState confirms Collapsed', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'collapseElement') {
        return null;
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Collapsed';
      }
      return null;
    });
    await patternCollapse.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'collapseElement', {elementId: ELEMENT_ID});
    assertNoSetFocus(driver.sendCommand);
  });

  it('patternCollapse falls back to ALT+Down for a ComboBox when collapseElement throws', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'collapseElement') {
        throw new Error('does not support ExpandCollapsePattern');
      }
      if (method === 'getProperty' && args.property === 'ControlType') {
        return 'ComboBox';
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Collapsed';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    await patternCollapse.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  it('patternCollapse falls back to ALT+Down when collapseElement succeeds but state never confirms', async () => {
    const driver = createMockDriver() as any;
    let collapsed = false;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'collapseElement') {
        return null;
      }
      if (method === 'setFocus') {
        collapsed = true;
        return null;
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return collapsed ? 'Collapsed' : 'Expanded';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    await patternCollapse.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  it('patternCollapse falls back to a real click when SetFocus does not confirm keyboard focus', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'collapseElement') {
        throw new Error('does not support ExpandCollapsePattern');
      }
      if (method === 'getProperty' && args.property === 'ControlType') {
        return 'ComboBox';
      }
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Collapsed';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return false;
      }
      if (method === 'getProperty' && args.property === 'ClickablePoint') {
        return {x: 10, y: 20};
      }
      return null;
    });
    await patternCollapse.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
    assertCalledWith(driver.sendCommand, 'getProperty', {elementId: ELEMENT_ID, property: 'ClickablePoint'});
  });

  it('patternCollapse resolves without throwing when native and ALT+Down both fail to confirm collapse', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async (method: string, args: any) => {
      if (method === 'getProperty' && args.property === 'ExpandCollapseState') {
        return 'Expanded';
      }
      if (method === 'getProperty' && args.property === 'HasKeyboardFocus') {
        return true;
      }
      return null;
    });
    assert.equal(await patternCollapse.call(driver, MOCK_ELEMENT), undefined);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });

  const EXPAND_COLLAPSE = [
    {name: 'patternExpand', fn: patternExpand, method: 'expandElement'},
    {name: 'patternCollapse', fn: patternCollapse, method: 'collapseElement'},
  ];

  // Server-verified expand/collapse failures (InvalidElementState) must reach the caller —
  // ALT+Down sent to a grid row or tree item would do something unrelated and mask it.
  const stateError = () => new errors.InvalidElementStateError('InvalidElementState: expand had no effect');

  for (const {name, fn, method} of EXPAND_COLLAPSE) {
    it(`${name} rethrows InvalidElementState for a non-ComboBox without sending ALT+Down`, async () => {
      const driver = createMockDriver() as any;
      driver.sendCommand.mock.mockImplementation(async (m: string, args: any) => {
        if (m === method) {
          throw stateError();
        }
        if (m === 'getProperty' && args.property === 'ControlType') {
          return 'TreeItem';
        }
        return null;
      });
      await assert.rejects(fn.call(driver, MOCK_ELEMENT), errors.InvalidElementStateError);
      assertNoSetFocus(driver.sendCommand);
    });
  }

  // An element with no expand/collapse at all (PatternNotSupported) must surface too —
  // ALT+Down to a button or a tree leaf would silently "succeed".
  for (const {name, fn, method} of EXPAND_COLLAPSE) {
    it(`${name} rethrows PatternNotSupported for a non-ComboBox without sending ALT+Down`, async () => {
      const driver = createMockDriver() as any;
      driver.sendCommand.mock.mockImplementation(async (m: string, args: any) => {
        if (m === method) {
          throw new errors.UnknownError('PatternNotSupported: collapse is not supported for JButton');
        }
        if (m === 'getProperty' && args.property === 'ControlType') {
          return 'Button';
        }
        return null;
      });
      await assert.rejects(fn.call(driver, MOCK_ELEMENT), /PatternNotSupported/);
      assertNoSetFocus(driver.sendCommand);
    });
  }

  for (const {name, fn, method} of EXPAND_COLLAPSE) {
    it(`${name} rethrows InvalidElementState when the control type is unreadable`, async () => {
      const driver = createMockDriver() as any;
      driver.sendCommand.mock.mockImplementation(async (m: string, args: any) => {
        if (m === method) {
          throw stateError();
        }
        if (m === 'getProperty' && args.property === 'ControlType') {
          throw new Error('gone');
        }
        return null;
      });
      await assert.rejects(fn.call(driver, MOCK_ELEMENT), errors.InvalidElementStateError);
      assertNoSetFocus(driver.sendCommand);
    });
  }

  for (const {name, fn, method} of EXPAND_COLLAPSE) {
    it(`${name} keeps the ALT+Down fallback for a ComboBox on InvalidElementState`, async () => {
      const driver = createMockDriver() as any;
      driver.sendCommand.mock.mockImplementation(async (m: string, args: any) => {
        if (m === method) {
          throw stateError();
        }
        if (m === 'getProperty' && args.property === 'ControlType') {
          return 'ComboBox';
        }
        if (m === 'getProperty' && args.property === 'HasKeyboardFocus') {
          return true;
        }
        return null;
      });
      await fn.call(driver, MOCK_ELEMENT);
      assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
    });
  }

  it('patternIsMultiple returns true when result is true', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => true);
    const result = await patternIsMultiple.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'isMultipleSelect', {elementId: ELEMENT_ID});
    assert.equal(result, true);
  });

  it('patternIsMultiple returns false when result is false', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => false);
    const result = await patternIsMultiple.call(driver, MOCK_ELEMENT);
    assert.equal(result, false);
  });

  it('patternGetSelectedItem returns element when selection exists', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ['2.3.4.5.6']);
    const result = await patternGetSelectedItem.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'getSelectedElements', {elementId: ELEMENT_ID});
    assert.deepEqual(result, {[W3C_ELEMENT_KEY]: '2.3.4.5.6'});
  });

  it('patternGetSelectedItem throws when no selection', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => []);
    await assert.rejects(patternGetSelectedItem.call(driver, MOCK_ELEMENT));
  });

  it('patternGetAllSelectedItems returns array of elements', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => ['2.3.4.5.6', '3.4.5.6.7']);
    const result = await patternGetAllSelectedItems.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'getSelectedElements', {elementId: ELEMENT_ID});
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {[W3C_ELEMENT_KEY]: '2.3.4.5.6'});
    assert.deepEqual(result[1], {[W3C_ELEMENT_KEY]: '3.4.5.6.7'});
  });

  it('patternSetValue calls setElementValue first', async () => {
    const driver = createMockDriver() as any;
    await patternSetValue.call(driver, MOCK_ELEMENT, 'test value');
    assertCalledWith(driver.sendCommand, 'setElementValue', {elementId: ELEMENT_ID, value: 'test value'});
  });

  it('patternSetValue falls back to setElementRangeValue when setElementValue throws', async () => {
    const driver = createMockDriver() as any;
    queueRejected(driver.sendCommand, new Error('not a value pattern'));
    await patternSetValue.call(driver, MOCK_ELEMENT, '42');
    assertCalledWith(driver.sendCommand, 'setElementRangeValue', {elementId: ELEMENT_ID, value: 42});
  });

  it('patternGetValue sends getElementValue command', async () => {
    const driver = createMockDriver() as any;
    driver.sendCommand.mock.mockImplementation(async () => 'some value');
    const result = await patternGetValue.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'getElementValue', {elementId: ELEMENT_ID});
    assert.equal(result, 'some value');
  });

  it('focusElement sends setFocus command', async () => {
    const driver = createMockDriver() as any;
    await focusElement.call(driver, MOCK_ELEMENT);
    assertCalledWith(driver.sendCommand, 'setFocus', {elementId: ELEMENT_ID});
  });
});
