import { registerCommand } from './registry.js';
import { helpCommand } from './help.js';
import { newCommand } from './new.js';
import { statusCommand } from './status.js';
import { toolsCommand } from './tools.js';
import { stopCommand } from './stop.js';

registerCommand(helpCommand);
registerCommand(newCommand);
registerCommand(statusCommand);
registerCommand(toolsCommand);
registerCommand(stopCommand);
