import { registerCommand } from './registry.js';
import { helpCommand } from './help.js';
import { newCommand } from './new.js';
import { statusCommand } from './status.js';
import { toolsCommand } from './tools.js';
import { stopCommand } from './stop.js';
import {
  memoryCommand,
  rememberCommand,
  forgetCommand,
  searchCommand,
  clearCommand,
} from './memory-commands.js';

registerCommand(helpCommand);
registerCommand(newCommand);
registerCommand(statusCommand);
registerCommand(toolsCommand);
registerCommand(stopCommand);
registerCommand(memoryCommand);
registerCommand(rememberCommand);
registerCommand(forgetCommand);
registerCommand(searchCommand);
registerCommand(clearCommand);
