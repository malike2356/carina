import { registerCommand } from './registry.js';
import { helpCommand } from './help.js';
import { newCommand } from './new.js';
import { statusCommand } from './status.js';
import { toolsCommand } from './tools.js';
import { stopCommand } from './stop.js';
import { contactsCommand } from './contacts.js';
import {
  configCommand,
  incognitoCommand,
  incognitoOffCommand,
  incognitoOnCommand,
  voiceCommand,
  voiceOffCommand,
  voiceOnCommand,
} from './config-commands.js';
import { byokCommand } from './byok-commands.js';
import {
  memoryCommand,
  rememberCommand,
  forgetCommand,
  searchCommand,
  clearCommand,
} from './memory-commands.js';
import { chatsCommand, linkCommand } from './link-commands.js';
import { vaultCommand } from './vault-commands.js';

registerCommand(helpCommand);
registerCommand(newCommand);
registerCommand(statusCommand);
registerCommand(toolsCommand);
registerCommand(stopCommand);
registerCommand(contactsCommand);
registerCommand(voiceCommand);
registerCommand(voiceOnCommand);
registerCommand(voiceOffCommand);
registerCommand(incognitoCommand);
registerCommand(incognitoOnCommand);
registerCommand(incognitoOffCommand);
registerCommand(configCommand);
registerCommand(byokCommand);
registerCommand(memoryCommand);
registerCommand(rememberCommand);
registerCommand(forgetCommand);
registerCommand(searchCommand);
registerCommand(clearCommand);
registerCommand(linkCommand);
registerCommand(chatsCommand);
registerCommand(vaultCommand);
