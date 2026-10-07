/**
 * Regression guard for the move from the PowerShell-object pipeline (convertStringToCondition +
 * conditionToDto, since removed) to parseUiaSelector.
 *
 * selector-corpus.golden.json holds the old pipeline's output for every SELECTOR_CORPUS entry,
 * recorded while both implementations were in the tree and compared live. The DTO parser must
 * keep reproducing it. INTENDED_CHANGES lists the deliberate deviations (each a selector that
 * was broken before).
 */
import {readFileSync} from 'node:fs';

import {errors} from 'appium/driver';
import {describe, expect, it} from 'vitest';

import {parseUiaSelector} from '@/uia-selector/parser';

import {INTENDED_CHANGES, SELECTOR_CORPUS} from './selector-corpus';

type Outcome = {dto: unknown} | {error: string; message?: string};

function outcome(selector: string): Outcome {
  try {
    return {dto: parseUiaSelector(selector)};
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

const golden: ({selector: string} & Outcome)[] = JSON.parse(
  readFileSync(new URL('./selector-corpus.golden.json', import.meta.url), 'utf8'),
);

describe('parseUiaSelector parity with the PowerShell-object pipeline', () => {
  it('golden file covers the whole corpus', () => {
    expect(golden.map((g) => g.selector)).toEqual(SELECTOR_CORPUS);
  });

  it.each(golden.map(({selector, ...expected}) => [selector, expected]))('%s', (selector, expected) => {
    expect(outcome(selector)).toEqual(expected);
  });
});

describe('parseUiaSelector intended deviations from the PowerShell-object pipeline', () => {
  it.each(INTENDED_CHANGES.map((c) => [c.selector, c]))('%s', (selector, {before, after}) => {
    expect(after).not.toEqual(before);
    expect(outcome(selector)).toEqual(after);
  });
});
