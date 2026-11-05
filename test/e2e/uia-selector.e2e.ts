import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';

import type {Browser} from 'webdriverio';

import type {RectResult} from '../../lib/server/protocol.js';
import {closeAllTestApps, createCalculatorSession, quitSession} from './helpers/session.js';

const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';
const BUTTON_ID = 'num1Button';

const P = (property: string, value: string) => `[PropertyCondition]::new([AutomationElement]::${property}, ${value})`;
const AUTOMATION_ID = (id: string) => P('AutomationIdProperty', `'${id}'`);
/** Narrows a condition to the test button, so it asserts on that element and not on any match in the app. */
const ON_BUTTON = (condition: string) => `[AndCondition]::new(${AUTOMATION_ID(BUTTON_ID)}, ${condition})`;

describe('-windows uiautomation selectors', () => {
  let driver: Browser;

  /** The AutomationIds of everything the selector finds. */
  const findIds = async (selector: string): Promise<(string | null)[]> => {
    const elements = await driver.findElements('-windows uiautomation', selector);
    return Promise.all(
      elements.map((el) =>
        driver.getElementAttribute((el as unknown as Record<string, string>)[W3C_ELEMENT_KEY], 'AutomationId'),
      ),
    );
  };

  const buttonElementId = async (): Promise<string> => driver.$(`~${BUTTON_ID}`).elementId;

  before(async () => {
    closeAllTestApps();
    driver = await createCalculatorSession();
    await driver.$('~CalculatorResults').waitForExist({timeout: 10_000});
    await driver.setTimeout({implicit: 0});
  });

  after(async () => {
    await quitSession(driver);
  });

  describe('strings and control types', () => {
    it('finds by a single-quoted and a double-quoted string', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('NameProperty', `'One'`))), [BUTTON_ID]);
      assert.deepEqual(await findIds(ON_BUTTON(P('NameProperty', `"One"`))), [BUTTON_ID]);
    });

    it('finds by control type', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('ControlTypeProperty', '[ControlType]::Button'))), [BUTTON_ID]);
      assert.deepEqual(await findIds(ON_BUTTON(P('ControlTypeProperty', '[ControlType]::Edit'))), []);
    });

    it('accepts the C#-style spelling', async () => {
      assert.deepEqual(await findIds(`new PropertyCondition(AutomationElement.AutomationIdProperty, '${BUTTON_ID}')`), [
        BUTTON_ID,
      ]);
    });
  });

  describe('logical conditions', () => {
    it('combines with OrCondition', async () => {
      const ids = await findIds(`[OrCondition]::new(${AUTOMATION_ID('num1Button')}, ${AUTOMATION_ID('num2Button')})`);
      assert.deepEqual(new Set(ids), new Set(['num1Button', 'num2Button']));
    });

    it('excludes with NotCondition', async () => {
      const notButton = `[NotCondition]::new(${P('ControlTypeProperty', '[ControlType]::Button')})`;
      assert.deepEqual(await findIds(ON_BUTTON(notButton)), []);
    });
  });

  describe('boolean values', () => {
    it('matches $true and bare true', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('IsEnabledProperty', '$true'))), [BUTTON_ID]);
      assert.deepEqual(await findIds(ON_BUTTON(P('IsEnabledProperty', 'true'))), [BUTTON_ID]);
    });

    it('does not match $false', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('IsEnabledProperty', '$false'))), []);
    });
  });

  describe('BoundingRectangle', () => {
    it('is rejected with a clear error', async () => {
      await assert.rejects(findIds(P('BoundingRectangleProperty', '[Rect]::new(1, 2, 3, 4)')), /not supported/);
    });

    it('stays readable as an attribute', async () => {
      const rect = (await driver.getElementAttribute(
        await buttonElementId(),
        'BoundingRectangle',
      )) as unknown as RectResult;

      assert.ok(rect.width > 0 && rect.height > 0);
    });
  });

  describe('ClickablePoint', () => {
    const clickablePoint = async (): Promise<{x: number; y: number}> =>
      (await driver.getElementAttribute(await buttonElementId(), 'ClickablePoint')) as unknown as {
        x: number;
        y: number;
      };

    it('finds the element from its ClickablePoint attribute', async () => {
      const {x, y} = await clickablePoint();

      assert.deepEqual(await findIds(ON_BUTTON(P('ClickablePointProperty', `[Point]::new(${x}, ${y})`))), [BUTTON_ID]);
    });

    it('finds nothing for a point that is off by one', async () => {
      const {x, y} = await clickablePoint();

      assert.deepEqual(await findIds(ON_BUTTON(P('ClickablePointProperty', `[Point]::new(${x + 1}, ${y})`))), []);
    });
  });

  describe('enum values', () => {
    it('matches HeadingLevel None by name and raw level', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('HeadingLevelProperty', '[AutomationHeadingLevel]::None'))), [
        BUTTON_ID,
      ]);
      assert.deepEqual(await findIds(ON_BUTTON(P('HeadingLevelProperty', '0'))), [BUTTON_ID]);
    });

    it('does not match another HeadingLevel', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('HeadingLevelProperty', '[AutomationHeadingLevel]::Level2'))), []);
    });

    it('matches Orientation None by name and raw value', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('OrientationProperty', '[OrientationType]::None'))), [BUTTON_ID]);
      assert.deepEqual(await findIds(ON_BUTTON(P('OrientationProperty', '0'))), [BUTTON_ID]);
    });

    it('matches the Culture the element reports', async () => {
      const lcid = await driver.getElementAttribute(await buttonElementId(), 'Culture');

      assert.deepEqual(await findIds(ON_BUTTON(P('CultureProperty', `[CultureInfo]::new(${lcid})`))), [BUTTON_ID]);
    });

    it('does not match another Orientation', async () => {
      assert.deepEqual(await findIds(ON_BUTTON(P('OrientationProperty', '[OrientationType]::Vertical'))), []);
    });
  });

  describe('css selector', () => {
    it('finds through the same parser', async () => {
      const element = await driver.findElement('css selector', `button[automation-id="${BUTTON_ID}"]`);
      const id = (element as unknown as Record<string, string>)[W3C_ELEMENT_KEY];

      assert.equal(await driver.getElementAttribute(id, 'AutomationId'), BUTTON_ID);
    });
  });
});
