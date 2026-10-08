import * as actions from './actions.js';
import * as app from './app.js';
import * as contexts from './contexts.js';
import * as device from './device.js';
import * as element from './element.js';
import * as executeMethods from './execute-methods.js';
import * as extension from './extension.js';
import * as ieSession from './ie-session.js';
import * as native from './native.js';
import * as serverSession from './server-session.js';
import * as system from './system.js';

const commands = {
  ...actions,
  ...serverSession,
  ...ieSession,
  ...element,
  ...extension,
  ...executeMethods,
  ...system,
  ...device,
  ...app,
  ...contexts,
  ...native,
  // add the rest of the commands here
};

type Commands = {
  [key in keyof typeof commands]: (typeof commands)[key];
};

declare module '../driver.js' {
  interface AppiumWincoreDriver extends Commands {}
}

export default commands;
