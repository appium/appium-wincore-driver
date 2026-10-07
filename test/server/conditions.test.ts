/**
 * Unit tests for propertyCondition name normalisation (lib/server/conditions.ts).
 */
import {describe, it, expect} from 'vitest';

import {propertyCondition} from '../../lib/server/conditions';

describe('propertyCondition', () => {
  it.each([
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
  ])('normalises %s to %s', (input, expected) => {
    expect(propertyCondition(input, 'x')).toEqual({type: 'property', property: expected, value: 'x'});
  });

  it('passes unknown names through unchanged (the server validates them)', () => {
    expect(propertyCondition('LegacyIAccessible.Value', 'x').property).toBe('LegacyIAccessible.Value');
  });
});
