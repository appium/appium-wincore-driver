import type {AttributeSchema} from '@appium/css-locator-to-native';

/**
 * CSS attribute vocabulary supported by `css selector` locators, mapped to the subset of
 * AutomationElement properties that our `-windows uiautomation` condition DSL can express.
 * `control-type` is handled specially by the emitter (it needs a `[ControlType]::x` literal,
 * not a plain string value) rather than going through the generic string-attribute path.
 */
export const ATTRIBUTE_SCHEMA: AttributeSchema = {
  attributes: {
    name: {type: 'string'},
    'automation-id': {type: 'string', aliases: ['id', 'accessibility-id']},
    'class-name': {type: 'string', aliases: ['class']},
    'control-type': {type: 'string'},
    'localized-control-type': {type: 'string'},
    'help-text': {type: 'string'},
    'framework-id': {type: 'string'},
    'item-status': {type: 'string'},
    'item-type': {type: 'string'},
    // Boolean attributes (enabled, offscreen, ...) are not mapped yet: UiaConditionEmitter only
    // emits string values, although the `-windows uiautomation` DSL accepts $true/$false.
  },
};
