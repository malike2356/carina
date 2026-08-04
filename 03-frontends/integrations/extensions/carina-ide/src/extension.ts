import * as vscode from 'vscode';
import { CarinaClient } from './carinaClient';
import { CarinaChatProvider } from './chatViewProvider';
import { AcpWsClient } from './acpWsClient';

const outputChannel = vscode.window.createOutputChannel('Carina');

function detectClientName(): string {
  const app = vscode.env.appName.toLowerCase();
  if (app.includes('cursor')) return 'cursor';
  if (app.includes('zed')) return 'zed';
  return 'vscode';
}

export function activate(context: vscode.ExtensionContext): void {
  const client = new CarinaClient();
  const acpClient = new AcpWsClient();
  const chat = new CarinaChatProvider(context.extensionUri, client, detectClientName());

  acpClient.onOutput((token) => {
    outputChannel.append(token);
  });

  context.subscriptions.push(
    outputChannel,
    vscode.window.registerWebviewViewProvider(CarinaChatProvider.viewType, chat),
    vscode.commands.registerCommand('carina.connect', async () => {
      try {
        await acpClient.connect();
        vscode.window.showInformationMessage(`Connected to Carina ACP (ws://127.0.0.1:${acpClient.port})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Carina ACP connect failed: ${msg}`);
      }
    }),
    vscode.commands.registerCommand('carina.acpAsk', async () => {
      if (!acpClient.connected) {
        try {
          await acpClient.connect();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Carina ACP connect failed: ${msg}`);
          return;
        }
      }
      const input = await vscode.window.showInputBox({ prompt: 'Ask Carina...' });
      if (!input?.trim()) return;
      outputChannel.show();
      outputChannel.appendLine(`\nYou: ${input.trim()}`);
      outputChannel.append('Carina: ');
      try {
        await acpClient.ask(input.trim());
        outputChannel.appendLine('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`\nError: ${msg}`);
      }
    }),
    vscode.commands.registerCommand('carina.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select code or text first.');
        return;
      }
      if (!acpClient.connected) {
        try {
          await acpClient.connect();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Carina ACP connect failed: ${msg}`);
          return;
        }
      }
      const selection = editor.document.getText(editor.selection);
      const language = editor.document.languageId;
      const prompt = `Explain this ${language} code:\n\`\`\`${language}\n${selection}\n\`\`\``;
      outputChannel.show();
      outputChannel.appendLine(`\nExplain selection (${language}):`);
      outputChannel.append('Carina: ');
      try {
        await acpClient.ask(prompt);
        outputChannel.appendLine('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`\nError: ${msg}`);
      }
    }),
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
