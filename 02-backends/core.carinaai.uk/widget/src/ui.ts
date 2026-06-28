export const WIDGET_STYLES = (accent: string) => `
  :host { all: initial; font-family: system-ui, -apple-system, sans-serif; }

  #launcher {
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    width: 56px; height: 56px; border-radius: 50%;
    background: ${accent};
    border: none; cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.20);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  #launcher:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(0,0,0,0.26); }
  #launcher:active { transform: scale(0.96); }
  #launcher svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2;
                  stroke-linecap: round; stroke-linejoin: round; transition: opacity 0.15s; }
  #launcher .icon-chat  { opacity: 1; position: absolute; }
  #launcher .icon-close { opacity: 0; position: absolute; }
  #launcher.open .icon-chat  { opacity: 0; }
  #launcher.open .icon-close { opacity: 1; }

  #unread {
    position: fixed; bottom: 68px; right: 20px; z-index: 2147483647;
    background: #ef4444; color: #fff;
    width: 20px; height: 20px; border-radius: 50%;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  #unread.hidden { display: none; }

  #panel {
    position: fixed; bottom: 96px; right: 24px; z-index: 2147483646;
    width: 360px; height: 520px;
    border-radius: 16px; overflow: hidden;
    background: #ffffff; color: #111827;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    display: flex; flex-direction: column;
    opacity: 0; pointer-events: none;
    transform: translateY(12px);
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  }
  #panel.open { opacity: 1; pointer-events: all; transform: translateY(0); }

  #header {
    background: ${accent}; color: #fff;
    padding: 14px 16px 12px;
    display: flex; align-items: center; justify-content: space-between;
    shrink: 0; flex-shrink: 0;
  }
  #header-left { display: flex; align-items: center; gap: 10px; }
  #header-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: #fff; flex-shrink: 0;
  }
  #header-info { line-height: 1.2; }
  #header-name { font-size: 14px; font-weight: 600; }
  #header-role { font-size: 11px; opacity: 0.85; }
  #status-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: #4ade80; margin-right: 4px;
    box-shadow: 0 0 0 2px rgba(74,222,128,0.3);
  }
  #close-btn {
    background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer;
    padding: 4px; display: flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: background 0.1s;
  }
  #close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
  #close-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor;
                   stroke-width: 2; stroke-linecap: round; }

  #messages {
    flex: 1; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 2px;
    scroll-behavior: smooth;
  }
  #messages::-webkit-scrollbar { width: 4px; }
  #messages::-webkit-scrollbar-track { background: transparent; }
  #messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }

  .bubble-row { display: flex; flex-direction: column; margin-bottom: 2px; }
  .bubble-row.user  { align-items: flex-end; }
  .bubble-row.aiva  { align-items: flex-start; flex-direction: row; gap: 8px; }

  .bubble {
    max-width: 78%; padding: 10px 14px;
    font-size: 13px; line-height: 1.55;
    word-break: break-word; white-space: pre-wrap;
  }
  .bubble.user {
    background: ${accent}; color: #fff;
    border-radius: 18px 18px 4px 18px;
  }
  .bubble.aiva {
    background: #f3f4f6; color: #111827;
    border-radius: 18px 18px 18px 4px;
  }

  .aiva-avatar {
    width: 24px; height: 24px; border-radius: 50%;
    background: ${accent}20; color: ${accent};
    font-size: 10px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  }

  .bubble-ts {
    font-size: 10px; color: #9ca3af; margin-top: 2px;
    padding: 0 4px;
  }
  .bubble-row.user .bubble-ts { text-align: right; }

  .typing-bubble {
    background: #f3f4f6; border-radius: 18px 18px 18px 4px;
    padding: 12px 16px;
    display: flex; align-items: center; gap: 5px;
  }
  .typing-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;
    animation: typing-bounce 1.4s ease-in-out infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing-bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40%            { transform: translateY(-6px); opacity: 1; }
  }

  #input-row {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 12px 12px 12px;
    border-top: 1px solid #f3f4f6;
    background: #fff; flex-shrink: 0;
  }
  #input {
    flex: 1; border: 1px solid #e5e7eb; border-radius: 20px;
    padding: 8px 14px; font-size: 13px; line-height: 1.4;
    outline: none; resize: none; font-family: inherit;
    color: #111827; background: #fff;
    max-height: 96px; overflow-y: auto;
    transition: border-color 0.15s;
  }
  #input:focus { border-color: ${accent}; }
  #input::placeholder { color: #9ca3af; }
  #send {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
    background: ${accent}; color: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, transform 0.1s;
  }
  #send:hover { filter: brightness(1.1); }
  #send:active { transform: scale(0.94); }
  #send svg { width: 16px; height: 16px; fill: none; stroke: #fff;
              stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  #send:disabled { opacity: 0.4; cursor: default; }

  #footer {
    text-align: center; font-size: 10px; color: #d1d5db;
    padding: 4px 0 8px; background: #fff; flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  @media (max-width: 480px) {
    #panel { left: 12px; right: 12px; width: auto; bottom: 84px; height: 60vh; max-height: 480px; border-radius: 12px; }
    #launcher { bottom: 16px; right: 16px; }
    #unread  { bottom: 60px; right: 12px; }
  }
`;

export function buildHTML(config: {
  workerName: string;
  workerRole: string;
  poweredByLabel: string;
  logoUrl?: string | null;
  hideAttribution?: boolean;
}) {
  const initial = config.workerName.charAt(0).toUpperCase();
  const avatar = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" />`
    : initial;
  const footer = config.hideAttribution || !config.poweredByLabel
    ? ''
    : `<div id="footer">${config.poweredByLabel}</div>`;
  return `
    <button id="launcher" aria-label="Chat with ${config.workerName}">
      <svg class="icon-chat" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div id="unread" class="hidden"></div>
    <div id="panel" role="dialog" aria-label="Chat with ${config.workerName}">
      <div id="header">
        <div id="header-left">
          <div id="header-avatar">${avatar}</div>
          <div id="header-info">
            <div id="header-name"><span id="status-dot"></span>${config.workerName}</div>
            <div id="header-role">${config.workerRole}</div>
          </div>
        </div>
        <button id="close-btn" aria-label="Close chat">
          <svg viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="messages"></div>
      <div id="input-row">
        <textarea id="input" rows="1" placeholder="Type a message..." aria-label="Message"></textarea>
        <button id="send" aria-label="Send">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      ${footer}
    </div>
  `;
}
