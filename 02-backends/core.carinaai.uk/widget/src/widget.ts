import { createSession, fetchConfig, streamMessage, type WidgetConfig } from './api';
import { renderWidgetMarkdown } from './markdown';
import { loadToken, saveToken } from './store';
import { WIDGET_STYLES, buildHTML } from './ui';

export class CarinaWidget {
  private workerId: string;
  private apiBase: string;
  private overrides: Record<string, string>;
  private config: WidgetConfig | null = null;
  private sessionToken: string | null = null;
  private root: ShadowRoot | null = null;
  private isOpen = false;
  private unreadCount = 0;
  private isSending = false;

  constructor(workerId: string, options: { apiBase: string; overrides?: Record<string, string> }) {
    this.workerId = workerId;
    this.apiBase = options.apiBase.replace(/\/$/, '');
    this.overrides = options.overrides ?? {};
  }

  async init(): Promise<void> {
    this.config = await fetchConfig(this.apiBase, this.workerId);
    if (!this.config) {
      throw new Error(
        `Could not load widget config for worker ${this.workerId}. Check the id, worker status is active, and ${this.apiBase} is reachable.`,
      );
    }

    if (this.overrides.accentColor) this.config.accentColor = this.overrides.accentColor;
    if (this.overrides.widgetName) this.config.workerName = this.overrides.widgetName;

    this.sessionToken = loadToken(this.workerId);
    const newToken = await createSession(this.apiBase, this.workerId, this.sessionToken);
    if (!newToken) {
      throw new Error('Could not create a widget chat session.');
    }
    this.sessionToken = newToken;
    saveToken(this.workerId, newToken);

    this.mountUI();
    this.appendAivaMessage(this.config.welcomeMessage, false);
  }

  private mountUI(): void {
    const host = document.createElement('div');
    host.id = 'carina-widget-host';
    document.body.appendChild(host);
    this.root = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES(this.config!.accentColor);
    this.root.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML(this.config!);
    while (wrapper.firstChild) this.root.appendChild(wrapper.firstChild);

    this.root.getElementById('launcher')!.addEventListener('click', () => this.toggle());
    this.root.getElementById('close-btn')!.addEventListener('click', () => this.close());
    this.root.getElementById('send')!.addEventListener('click', () => void this.handleSend());

    const textarea = this.root.getElementById('input') as HTMLTextAreaElement;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.handleSend();
      }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    });
  }

  private toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.root!.getElementById('panel')!.classList.add('open');
    this.root!.getElementById('launcher')!.classList.add('open');
    this.clearUnread();
    window.setTimeout(() => (this.root!.getElementById('input') as HTMLElement).focus(), 200);
  }

  private close(): void {
    this.isOpen = false;
    this.root!.getElementById('panel')!.classList.remove('open');
    this.root!.getElementById('launcher')!.classList.remove('open');
  }

  private clearUnread(): void {
    this.unreadCount = 0;
    const badge = this.root!.getElementById('unread')!;
    badge.classList.add('hidden');
    badge.textContent = '';
  }

  private incrementUnread(): void {
    if (this.isOpen) return;
    this.unreadCount += 1;
    const badge = this.root!.getElementById('unread')!;
    badge.textContent = String(this.unreadCount);
    badge.classList.remove('hidden');
  }

  private scrollToBottom(): void {
    const msgs = this.root!.getElementById('messages')!;
    msgs.scrollTop = msgs.scrollHeight;
  }

  private setAivaBubbleHtml(el: HTMLElement, text: string): void {
    el.innerHTML = renderWidgetMarkdown(text);
  }

  private appendUserMessage(text: string): void {
    const container = this.root!.getElementById('messages')!;
    const row = document.createElement('div');
    row.className = 'bubble-row user';
    row.innerHTML = `
      <div class="bubble user">${this.escapeHtml(text)}</div>
      <div class="bubble-ts">${this.formatTime()}</div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
  }

  private appendAivaMessage(text: string, countUnread = true): HTMLElement {
    const container = this.root!.getElementById('messages')!;
    const initial = this.config!.workerName.charAt(0).toUpperCase();
    const row = document.createElement('div');
    row.className = 'bubble-row aiva';
    row.innerHTML = `
      <div class="aiva-avatar">${initial}</div>
      <div>
        <div class="bubble aiva md-body">${renderWidgetMarkdown(text)}</div>
        <div class="bubble-ts">${this.formatTime()}</div>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
    if (countUnread) this.incrementUnread();
    return row.querySelector('.bubble.aiva') as HTMLElement;
  }

  private appendTypingIndicator(): HTMLElement {
    const container = this.root!.getElementById('messages')!;
    const row = document.createElement('div');
    row.className = 'bubble-row aiva';
    const initial = this.config!.workerName.charAt(0).toUpperCase();
    row.innerHTML = `
      <div class="aiva-avatar">${initial}</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
    return row;
  }

  private async handleSend(): Promise<void> {
    if (this.isSending) return;
    const textarea = this.root!.getElementById('input') as HTMLTextAreaElement;
    const text = textarea.value.trim();
    if (!text || !this.sessionToken) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    this.isSending = true;
    (this.root!.getElementById('send') as HTMLButtonElement).disabled = true;

    this.appendUserMessage(text);

    const typingRow = this.appendTypingIndicator();
    let aivaBubble: HTMLElement | null = null;
    let fullResponse = '';

    try {
      for await (const event of streamMessage(this.apiBase, this.workerId, this.sessionToken, text)) {
        if (event.type === 'token') {
          if (!aivaBubble) {
            typingRow.remove();
            const initial = this.config!.workerName.charAt(0).toUpperCase();
            const container = this.root!.getElementById('messages')!;
            const row = document.createElement('div');
            row.className = 'bubble-row aiva';
            row.innerHTML = `
              <div class="aiva-avatar">${initial}</div>
              <div>
                <div class="bubble aiva"></div>
                <div class="bubble-ts">${this.formatTime()}</div>
              </div>
            `;
            container.appendChild(row);
            aivaBubble = row.querySelector('.bubble.aiva') as HTMLElement;
          }
          fullResponse += event.content;
          this.setAivaBubbleHtml(aivaBubble, fullResponse);
          this.scrollToBottom();
        } else if (event.type === 'replace') {
          if (!aivaBubble) {
            typingRow.remove();
            const initial = this.config!.workerName.charAt(0).toUpperCase();
            const container = this.root!.getElementById('messages')!;
            const row = document.createElement('div');
            row.className = 'bubble-row aiva';
            row.innerHTML = `
              <div class="aiva-avatar">${initial}</div>
              <div>
                <div class="bubble aiva"></div>
                <div class="bubble-ts">${this.formatTime()}</div>
              </div>
            `;
            container.appendChild(row);
            aivaBubble = row.querySelector('.bubble.aiva') as HTMLElement;
          }
          fullResponse = event.content;
          this.setAivaBubbleHtml(aivaBubble, fullResponse);
          this.scrollToBottom();
        } else if (event.type === 'error') {
          typingRow.remove();
          this.appendAivaMessage('Sorry, something went wrong. Please try again.');
          break;
        }
      }
      if (fullResponse) this.incrementUnread();
    } finally {
      if (typingRow.isConnected) typingRow.remove();
      this.isSending = false;
      (this.root!.getElementById('send') as HTMLButtonElement).disabled = false;
      (this.root!.getElementById('input') as HTMLElement).focus();
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
