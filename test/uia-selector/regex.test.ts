/**
 * Unit tests for lib/uia-selector/regex.ts
 */
import {describe, it, expect} from 'vitest';

import {ConstructorRegexMatcher, PropertyRegexMatcher, RegexItem} from '../../lib/uia-selector/regex';

describe('namespace validation', () => {
  it('rejects namespaces with characters outside the allowed set', () => {
    expect(() => new PropertyRegexMatcher('System.Windows; rm -rf')).toThrow(/namespace/);
    expect(() => new ConstructorRegexMatcher('System.Windows.Point[]', new RegexItem(String.raw`\d+`))).toThrow(
      /namespace/,
    );
    expect(() => new PropertyRegexMatcher('')).toThrow(/namespace/);
  });

  it('accepts the regex-flavoured namespaces used by the converter', () => {
    expect(() => new ConstructorRegexMatcher('System.Windows.Automation.(?:And|Or|Not)(?:Condition)?')).not.toThrow();
    expect(() => new PropertyRegexMatcher('System.Windows.Automation.(?:Property)Condition', 'True')).not.toThrow();
    expect(() => new PropertyRegexMatcher('System.Windows.Automation.AutomationElement')).not.toThrow();
  });
});
