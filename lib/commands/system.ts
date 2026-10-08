import type {Orientation} from '@appium/types';

import type {AppiumWincoreDriver} from '../driver.js';
import {getDisplayOrientation} from '../winapi/user32.js';

/**
 * Gets the display orientation of the primary monitor.
 * @returns `PORTRAIT` or `LANDSCAPE`.
 */
export function getOrientation(this: AppiumWincoreDriver): Orientation {
  return getDisplayOrientation();
}
