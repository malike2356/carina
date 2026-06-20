/**
 * OSC8 hyperlinks for supported terminals (iTerm2, kitty, WezTerm, Windows Terminal).
 */
export function osc8Link(url: string, text: string): string {
  return `\x1b]8;${url}\x07${text}\x1b]8;\x07`;
}

export function stripOsc8(text: string): string {
  return text.replace(/\x1b\]8;[^\x07]*\x07/g, '');
}
