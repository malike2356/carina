import * as vscode from 'vscode';
import { CarinaClient } from './carinaClient';

export class CarinaChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'carina.chat';
  private view?: vscode.WebviewView;
  private readonly client: CarinaClient;
  private readonly clientName: string;

  constructor(
    private readonly extensionUri: vscode.Uri,
    client: CarinaClient,
    clientName = 'vscode',
  ) {
    this.client = client;
    this.clientName = clientName;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'send') {
        await this.handleSend(String(msg.text ?? ''));
      }
      if (msg.type === 'ping') {
        const ok = await this.client.health();
        webviewView.webview.postMessage({ type: 'status', connected: ok, url: this.client.baseUrl });
      }
    });

    void this.postStatus();
  }

  async focus(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
    } else {
      await vscode.commands.executeCommand('carina.chat.focus');
    }
  }

  async sendMessage(text: string): Promise<void> {
    await this.focus();
    await this.handleSend(text);
  }

  private async postStatus(): Promise<void> {
    const ok = await this.client.health();
    this.view?.webview.postMessage({ type: 'status', connected: ok, url: this.client.baseUrl });
  }

  private async handleSend(text: string): Promise<void> {
    const prompt = text.trim();
    if (!prompt || !this.view) return;

    this.view.webview.postMessage({ type: 'user', text: prompt });
    this.view.webview.postMessage({ type: 'assistant-start' });

    let reply = '';
    try {
      for await (const chunk of this.client.chatStream(prompt, this.clientName)) {
        if (chunk.type === 'text' && chunk.content) {
          reply += chunk.content;
          this.view.webview.postMessage({ type: 'assistant-chunk', text: chunk.content });
        }
        if (chunk.type === 'error') {
          throw new Error(chunk.error ?? 'stream error');
        }
      }
      if (!reply) {
        reply = await this.client.chat(prompt, this.clientName);
        this.view.webview.postMessage({ type: 'assistant-chunk', text: reply });
      }
      this.view.webview.postMessage({ type: 'assistant-end', text: reply });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.view.webview.postMessage({ type: 'assistant-error', text: msg });
    }
  }

  private getHtml(): string {
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'unsafe-inline'",
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    :root { color-scheme: light dark; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    body { margin: 0; display: flex; flex-direction: column; height: 100vh; background: var(--vscode-sideBar-background); color: var(--vscode-foreground); }
    #status { font-size: 11px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); opacity: 0.85; }
    #log { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .bubble { padding: 8px 10px; border-radius: 8px; max-width: 95%; white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
    .user { align-self: flex-end; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .assistant { align-self: flex-start; background: var(--vscode-editor-inactiveSelectionBackground); }
    .error { align-self: flex-start; color: var(--vscode-errorForeground); }
    #form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }
    #input { flex: 1; resize: none; min-height: 36px; max-height: 120px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 6px 8px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; border-radius: 4px; padding: 0 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="status">Connecting...</div>
  <div id="log"></div>
  <form id="form">
    <textarea id="input" rows="2" placeholder="Ask Carina..."></textarea>
    <button type="submit">Send</button>
  </form>
  <script>
    const vscode = acquireVsCodeApi();
    const log = document.getElementById('log');
    const status = document.getElementById('status');
    const input = document.getElementById('input');
    const form = document.getElementById('form');
    let assistantNode = null;

    function addBubble(role, text) {
      const el = document.createElement('div');
      el.className = 'bubble ' + role;
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'status') {
        status.textContent = msg.connected
          ? 'Connected to ' + msg.url
          : 'Carina unreachable at ' + msg.url + ' (run: carina web)';
      }
      if (msg.type === 'user') addBubble('user', msg.text);
      if (msg.type === 'assistant-start') {
        assistantNode = addBubble('assistant', '');
      }
      if (msg.type === 'assistant-chunk' && assistantNode) {
        assistantNode.textContent += msg.text;
        log.scrollTop = log.scrollHeight;
      }
      if (msg.type === 'assistant-end') assistantNode = null;
      if (msg.type === 'assistant-error') {
        addBubble('error', msg.text);
        assistantNode = null;
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      vscode.postMessage({ type: 'send', text });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    vscode.postMessage({ type: 'ping' });
  </script>
</body>
</html>`;
  }
}
