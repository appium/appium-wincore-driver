/**
 * Unit tests for propertyCondition name normalisation (lib/server/conditions.ts).
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {propertyCondition} from '../../lib/server/conditions.js';

describe('propertyCondition', () => {
  const cases: [string, string][] = [
    ['legacyvalue', 'LegacyValue'],
    ['LEGACYVALUE', 'LegacyValue'],
    ['LegacyValueProperty', 'LegacyValue'],
    ['legacyname', 'LegacyName'],
    ['legacydescription', 'LegacyDescription'],
    ['legacyrole', 'LegacyRole'],
    ['legacystate', 'LegacyState'],
    ['legacydefaultaction', 'LegacyDefaultAction'],
    ['value', 'Value'],
    ['providerdescription', 'ProviderDescription'],
  ];
  for (const [input, expected] of cases) {
    it(`normalises ${input} to ${expected}`, () => {
      assert.deepEqual(propertyCondition(input, 'x'), {type: 'property', property: expected, value: 'x'});
    });
  }

  it('passes unknown names through unchanged (the server validates them)', () => {
    assert.equal(propertyCondition('LegacyIAccessible.Value', 'x').property, 'LegacyIAccessible.Value');
  });
});
