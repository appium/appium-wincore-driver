/**
 * Old-vs-new comparison: the PowerShell-object pipeline (convertStringToCondition +
 * conditionToDto) against the DTO parser (parseUiaSelector), over a broad selector corpus.
 */
import {readFileSync, writeFileSync} from 'node:fs';

import {errors} from 'appium/driver';
import {describe, expect, it} from 'vitest';

import {convertStringToCondition} from '@/powershell/converter';
import {conditionToDto} from '@/server/converter-bridge';
import {parseUiaSelector} from '@/uia-selector/parser';

import {INTENDED_CHANGES, SELECTOR_CORPUS} from './selector-corpus';

type Outcome = {dto: unknown} | {error: string; message?: string};

function outcome(parse: () => unknown): Outcome {
  try {
    return {dto: parse()};
  } catch (e) {
    if (e instanceof errors.InvalidSelectorError) {
      return {error: 'InvalidSelectorError', message: e.message};
    }
    if (e instanceof errors.InvalidArgumentError) {
      // messages used to name PowerShell wrapper classes; only the error class is contract
      return {error: 'InvalidArgumentError'};
    }
    return {error: (e as Error).constructor.name, message: (e as Error).message};
  }
}

const oldPipeline = (selector: string) => outcome(() => conditionToDto(convertStringToCondition(selector)));
const newPipeline = (selector: string) => outcome(() => parseUiaSelector(selector));

const GOLDEN_PATH = new URL('./selector-corpus.golden.json', import.meta.url);

if (process.env.UPDATE_UIA_SELECTOR_GOLDEN) {
  const golden = SELECTOR_CORPUS.map((selector) => ({selector, ...oldPipeline(selector)}));
  writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n');
}

describe('golden corpus', () => {
  it('records the PowerShell-object pipeline output for every corpus selector', () => {
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    expect(golden).toEqual(SELECTOR_CORPUS.map((selector) => ({selector, ...oldPipeline(selector)})));
  });
});

describe('parseUiaSelector parity with the PowerShell-object pipeline', () => {
  it.each(SELECTOR_CORPUS.map((s) => [s]))('%s', (selector) => {
    expect(newPipeline(selector)).toEqual(oldPipeline(selector));
  });
});

describe('parseUiaSelector intended deviations from the PowerShell-object pipeline', () => {
  it.each(INTENDED_CHANGES.map((c) => [c.selector, c]))('%s', (selector, {before, after}) => {
    expect(oldPipeline(selector)).toEqual(before);
    expect(newPipeline(selector)).toEqual(after);
  });
});
