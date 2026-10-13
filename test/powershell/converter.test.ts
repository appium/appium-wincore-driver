/**
 * Unit tests for lib/powershell/converter.ts (convertStringToCondition)
 */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  PropertyCondition,
  AndCondition,
  OrCondition,
  NotCondition,
  TrueCondition,
  FalseCondition,
} from '../../lib/powershell/conditions.js';
import {convertStringToCondition} from '../../lib/powershell/converter.js';

describe('convertStringToCondition', () => {
  describe('TrueCondition / FalseCondition', () => {
    it('parses PropertyCondition TrueCondition', () => {
      // The TRUE_CONDITION_REGEX matches [PropertyCondition]::TrueCondition
      const condition = convertStringToCondition('[PropertyCondition]::TrueCondition');
      assert.ok(condition instanceof TrueCondition);
    });

    it('parses PropertyCondition FalseCondition', () => {
      const condition = convertStringToCondition('[PropertyCondition]::FalseCondition');
      assert.ok(condition instanceof FalseCondition);
    });

    it('parses Automation.RawViewCondition as TrueCondition', () => {
      const condition = convertStringToCondition('[Automation]::RawViewCondition');
      assert.ok(condition instanceof TrueCondition);
    });
  });

  describe('PropertyCondition', () => {
    it('parses name property condition with string value', () => {
      const condition = convertStringToCondition(
        "[PropertyCondition]::new([AutomationElement]::NameProperty, 'Calculator')",
      );
      assert.ok(condition instanceof PropertyCondition);
    });

    it('parses integer property condition (native window handle)', () => {
      const condition = convertStringToCondition(
        '[PropertyCondition]::new([AutomationElement]::NativeWindowHandleProperty, 12345)',
      );
      assert.ok(condition instanceof PropertyCondition);
    });

    it('parses control type property condition', () => {
      const condition = convertStringToCondition(
        '[PropertyCondition]::new([AutomationElement]::ControlTypeProperty, [ControlType]::Button)',
      );
      assert.ok(condition instanceof PropertyCondition);
    });

    it('parses automation id property condition', () => {
      const condition = convertStringToCondition(
        "[PropertyCondition]::new([AutomationElement]::AutomationIdProperty, 'btn_ok')",
      );
      assert.ok(condition instanceof PropertyCondition);
    });

    it('throws for unknown property name', () => {
      assert.throws(() =>
        convertStringToCondition("[PropertyCondition]::new([AutomationElement]::UnknownProp, 'value')"),
      );
    });
  });

  describe('AndCondition', () => {
    it('parses AND condition with two property conditions', () => {
      const condition = convertStringToCondition(
        "[AndCondition]::new([PropertyCondition]::new([AutomationElement]::NameProperty, 'Calc'), [PropertyCondition]::new([AutomationElement]::NameProperty, 'Test'))",
      );
      assert.ok(condition instanceof AndCondition);
    });

    it('parses AND condition with three conditions', () => {
      const condition = convertStringToCondition(
        "[AndCondition]::new([PropertyCondition]::new([AutomationElement]::NameProperty, 'A'), [PropertyCondition]::new([AutomationElement]::NameProperty, 'B'), [PropertyCondition]::new([AutomationElement]::NameProperty, 'C'))",
      );
      assert.ok(condition instanceof AndCondition);
    });
  });

  describe('OrCondition', () => {
    it('parses OR condition', () => {
      const condition = convertStringToCondition(
        "[OrCondition]::new([PropertyCondition]::new([AutomationElement]::NameProperty, 'A'), [PropertyCondition]::new([AutomationElement]::NameProperty, 'B'))",
      );
      assert.ok(condition instanceof OrCondition);
    });
  });

  describe('NotCondition', () => {
    it('parses NOT condition', () => {
      const condition = convertStringToCondition(
        "[NotCondition]::new([PropertyCondition]::new([AutomationElement]::NameProperty, 'test'))",
      );
      assert.ok(condition instanceof NotCondition);
    });
  });

  describe('ControlView / ContentView conditions', () => {
    it('parses ControlViewCondition as NotCondition', () => {
      const condition = convertStringToCondition('[Automation]::ControlViewCondition');
      assert.ok(condition instanceof NotCondition);
    });

    it('parses ContentViewCondition as NotCondition', () => {
      const condition = convertStringToCondition('[Automation]::ContentViewCondition');
      assert.ok(condition instanceof NotCondition);
    });
  });

  describe('integer array property condition', () => {
    it('parses runtime id condition with integer array', () => {
      const condition = convertStringToCondition(
        '[PropertyCondition]::new([AutomationElement]::RuntimeIdProperty, [int32[]] @(1, 2, 3))',
      );
      assert.ok(condition instanceof PropertyCondition);
    });
  });

  describe('error handling', () => {
    it('throws for an unrecognized selector', () => {
      assert.throws(() => convertStringToCondition('not a valid selector'));
    });

    it('throws for empty string', () => {
      assert.throws(() => convertStringToCondition(''));
    });

    it('throws when result is not a Condition', () => {
      // A plain integer is not a Condition
      assert.throws(() => convertStringToCondition('42'));
    });
  });

  describe('string value handling', () => {
    it('handles escaped single quotes in string values', () => {
      const condition = convertStringToCondition(
        "[PropertyCondition]::new([AutomationElement]::NameProperty, 'it''s')",
      );
      assert.ok(condition instanceof PropertyCondition);
    });

    it('handles string with special characters', () => {
      const condition = convertStringToCondition(
        "[PropertyCondition]::new([AutomationElement]::NameProperty, 'hello world')",
      );
      assert.ok(condition instanceof PropertyCondition);
    });
  });
});
