import { listCommands } from './channels/slash-commands/registry.js';

type TelegramApiResult = {
  ok?: boolean;
  description?: string;
  result?: unknown;
};

async function callTelegramApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as TelegramApiResult;
  if (!response.ok || !result.ok) {
    throw new Error(`${method} failed: ${result.description ?? `HTTP ${response.status}`}`);
  }
  return result;
}

export function carinaTelegramMenuCommands(): Array<{ command: string; description: string }> {
  const fromRegistry = listCommands()
    .map((entry) => ({
      command: entry.name.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32),
      description: entry.description.trim().slice(0, 256),
    }))
    .filter((entry) => entry.command.length > 0 && entry.description.length > 0);

  // Local gateway commands that are not in the slash registry.
  const extras = [
    { command: 'start', description: 'Welcome and command overview' },
    { command: 'history', description: 'Show recent messages from this chat' },
    { command: 'speak', description: 'Ask for a voice reply' },
  ];

  const seen = new Set<string>();
  const merged: Array<{ command: string; description: string }> = [];
  for (const entry of [...extras, ...fromRegistry]) {
    if (seen.has(entry.command)) continue;
    seen.add(entry.command);
    merged.push(entry);
  }
  return merged.slice(0, 100);
}

/** Register BotFather command menu for the Carina gateway bot. */
export async function registerCarinaTelegramCommands(botToken: string): Promise<void> {
  const commands = carinaTelegramMenuCommands();
  const scopes: Array<Record<string, unknown>> = [
    { type: 'default' },
    { type: 'all_private_chats' },
    { type: 'all_group_chats' },
  ];
  for (const scope of scopes) {
    await callTelegramApi(botToken, 'setMyCommands', { commands, scope });
  }
  await callTelegramApi(botToken, 'setChatMenuButton', {
    menu_button: { type: 'commands' },
  });
}
