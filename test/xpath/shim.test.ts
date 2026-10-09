import assert from 'node:assert/strict';
import {describe, it, mock} from 'node:test';

import {W3C_ELEMENT_KEY} from 'appium/driver.js';

import {xpathToElIdOrIds} from '../../lib/xpath/index.js';
import {assertCalledWith} from '../helpers/mock.js';

describe('xpath shim', () => {
  it('forwards the raw expression, context and multiple flag to evaluateXPath', async () => {
    const send = mock.fn(async () => ['a.b.c']);
    await xpathToElIdOrIds('//Button[@Name="One"]', true, 'ctx-1', send);
    assertCalledWith(send, 'evaluateXPath', {
      expression: '//Button[@Name="One"]',
      contextElementId: 'ctx-1',
      multiple: true,
    });
  });

  it('passes contextElementId: null when there is no context', async () => {
    const send = mock.fn(async () => null);
    await xpathToElIdOrIds('//Button', false, undefined, send).catch(() => {});
    assertCalledWith(send, 'evaluateXPath', {
      expression: '//Button',
      contextElementId: null,
      multiple: false,
    });
  });

  it('wraps every id as a W3C element reference for a multiple find', async () => {
    const send = mock.fn(async () => ['1.2', '3.4']);
    const els = await xpathToElIdOrIds('//Button', true, undefined, send);
    assert.deepEqual(els, [{[W3C_ELEMENT_KEY]: '1.2'}, {[W3C_ELEMENT_KEY]: '3.4'}]);
  });

  it('returns an empty array (not an error) when a multiple find matches nothing', async () => {
    const send = mock.fn(async () => []);
    assert.deepEqual(await xpathToElIdOrIds('//Nope', true, undefined, send), []);
  });

  it('returns a single element reference for a single find', async () => {
    const send = mock.fn(async () => '9.9');
    assert.deepEqual(await xpathToElIdOrIds('//Button', false, undefined, send), {[W3C_ELEMENT_KEY]: '9.9'});
  });

  it('throws NoSuchElementError when a single find matches nothing', async () => {
    const send = mock.fn(async () => null);
    await assert.rejects(xpathToElIdOrIds('//Nope', false, undefined, send), /could not be located/);
  });
});
