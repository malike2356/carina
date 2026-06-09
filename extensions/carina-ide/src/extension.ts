import * as vscode from 'vscode';
import { CarinaClient } from './carinaClient';
import { CarinaChatProvider } from './chatViewProvider';

function detectClientName(): string {
  const app = vscode.env.appName.toLowerCase();
  if (app.includes('cursor')) return 'cursor';
  if (app.includes('zed')) return 'zed';
  return 'vscode';
}

export function activate(context: vscode.ExtensionContext): void {
  const client = new CarinaClient();
  const chat = new CarinaChatProvider(context.extensionUri, client, detectClientName());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CarinaChatProvider.viewType, chat),
    vscode.commands.registerCommand('carina.ask', () => chat.focus()),
    vscode.commands.registerCommand('carina.askSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select code or text first.');
        return;
      }
      const selection = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      await chat.sendMessage(`About this ${lang} selection:\n\`\`\`${lang}\n${selection}\n\`\`\``);
    }),
    vscode.commands.registerCommand('carina.checkConnection', async () => {
      const ok = await client.health();
      if (ok) {
        const caps = await client.capabilities().catch(() => null);
        const providers = caps?.configured_providers?.join(', ') ?? 'unknown';
        vscode.window.showInformationMessage(`Carina connected (${client.baseUrl}). Providers: ${providers}`);
      } else {
        vscode.window.showErrorMessage(`Carina unreachable at ${client.baseUrl}. Start with: carina web`);
      }
    }),
    vscode.commands.registerCommand('carina.listTools', async () => {
      try {
        const tools = await client.listTools();
        const doc = await vscode.workspace.openTextDocument({
          content: tools.map((t) => `${t.name}: ${t.description}`).join('\n'),
          language: 'plaintext',
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(msg);
      }
    }),
  );

  void client.health().then((ok) => {
    if (!ok) {
      vscode.window.showWarningMessage(
        `Carina IDE: server not reachable at ${client.baseUrl}. Run "carina web" or "carina serve".`,
      );
    }
  });
}

export function deactivate(): void {}
