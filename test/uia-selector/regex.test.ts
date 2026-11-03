/**
 * Unit tests for lib/uia-selector/regex.ts
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {ConstructorRegexMatcher, PropertyRegexMatcher, RegexItem} from '../../lib/uia-selector/regex.js';

describe('namespace validation', () => {
  it('rejects namespaces with characters outside the allowed set', () => {
    assert.throws(() => new PropertyRegexMatcher('System.Windows; rm -rf'), /namespace/);
    assert.throws(
      () => new ConstructorRegexMatcher('System.Windows.Point[]', new RegexItem(String.raw`\d+`)),
      /namespace/,
    );
    assert.throws(() => new PropertyRegexMatcher(''), /namespace/);
  });

  it('accepts the regex-flavoured namespaces used by the converter', () => {
    assert.doesNotThrow(() => new ConstructorRegexMatcher('System.Windows.Automation.(?:And|Or|Not)(?:Condition)?'));
    assert.doesNotThrow(() => new PropertyRegexMatcher('System.Windows.Automation.(?:Property)Condition', 'True'));
    assert.doesNotThrow(() => new PropertyRegexMatcher('System.Windows.Automation.AutomationElement'));
  });
});
