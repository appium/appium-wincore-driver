/**
 * Unit tests for lib/powershell/core.ts (pwsh and pwsh$ tagged template literals)
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {pwsh, pwsh$} from '../../lib/powershell/core.js';

describe('pwsh', () => {
  it('wraps command in Invoke-Expression with base64 encoding', () => {
    const result = pwsh`Get-Process`;
    assert.ok(result.includes('Invoke-Expression'));
    assert.ok(result.includes('FromBase64String'));
    // Verify the base64-encoded content decodes to the command
    const base64Match = result.match(/FromBase64String\('([^']+)'\)/);
    assert.notEqual(base64Match, null);
    const decoded = Buffer.from(base64Match![1], 'base64').toString('utf8');
    assert.equal(decoded, 'Get-Process');
  });

  it('handles multi-line commands', () => {
    const result = pwsh`
            $a = 1
            $b = 2
        `;
    const base64Match = result.match(/FromBase64String\('([^']+)'\)/);
    assert.notEqual(base64Match, null);
    const decoded = Buffer.from(base64Match![1], 'base64').toString('utf8');
    assert.ok(decoded.includes('$a = 1'));
    assert.ok(decoded.includes('$b = 2'));
  });

  it('interpolates string values', () => {
    const varName = '$rootElement';
    const result = pwsh`Write-Output ${varName}`;
    const base64Match = result.match(/FromBase64String\('([^']+)'\)/);
    const decoded = Buffer.from(base64Match![1], 'base64').toString('utf8');
    assert.ok(decoded.includes('$rootElement'));
  });
});

describe('pwsh$', () => {
  it('returns a DeferredStringTemplate with base64 encoding on format', () => {
    const tpl = pwsh$`Write-Output ${0}`;
    const result = tpl.format('hello');
    assert.ok(result.includes('Invoke-Expression'));
    assert.ok(result.includes('FromBase64String'));
    const base64Match = result.match(/FromBase64String\('([^']+)'\)/);
    assert.notEqual(base64Match, null);
    const decoded = Buffer.from(base64Match![1], 'base64').toString('utf8');
    assert.ok(decoded.includes('hello'));
  });

  it('substitutes multiple positional arguments', () => {
    const tpl = pwsh$`${0}.Method(${1})`;
    const result = tpl.format('$element', '$condition');
    const base64Match = result.match(/FromBase64String\('([^']+)'\)/);
    const decoded = Buffer.from(base64Match![1], 'base64').toString('utf8');
    assert.equal(decoded, '$element.Method($condition)');
  });
});
