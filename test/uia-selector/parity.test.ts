/**
 * Regression guard for the move from the PowerShell-object pipeline (convertStringToCondition +
 * conditionToDto, since removed) to parseUiaSelector.
 *
 * selector-corpus.golden.json holds the old pipeline's output for every SELECTOR_CORPUS entry,
 * recorded while both implementations were in the tree and compared live. The DTO parser must
 * keep reproducing it. INTENDED_CHANGES lists the deliberate deviations (each a selector that
 * was broken before).
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

import {errors} from 'appium/driver.js';

import {parseUiaSelector} from '../../lib/uia-selector/parser.js';
import {INTENDED_CHANGES, SELECTOR_CORPUS} from './selector-corpus.js';

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
  readFileSync(new URL('../../../test/uia-selector/selector-corpus.golden.json', import.meta.url), 'utf8'),
);

describe('parseUiaSelector parity with the PowerShell-object pipeline', () => {
  it('golden file covers the whole corpus', () => {
    assert.deepEqual(
      golden.map((g) => g.selector),
      SELECTOR_CORPUS,
    );
  });

  for (const {selector, ...expected} of golden) {
    it(selector, () => {
      assert.deepEqual(outcome(selector), expected);
    });
  }
});

describe('parseUiaSelector intended deviations from the PowerShell-object pipeline', () => {
  for (const {selector, before, after} of INTENDED_CHANGES) {
    it(selector, () => {
      assert.notDeepEqual(after, before);
      assert.deepEqual(outcome(selector), after);
    });
  }
});
