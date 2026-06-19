import { useInput } from 'ink';

type KeyHandler = (input: string, key: { ctrl: boolean; escape: boolean; upArrow: boolean; downArrow: boolean }) => void;

export function useKeyboard(enabled: boolean, handler: KeyHandler): void {
  useInput((input, key) => {
    if (!enabled) return;
    handler(input, {
      ctrl: key.ctrl,
      escape: key.escape,
      upArrow: key.upArrow,
      downArrow: key.downArrow,
    });
  });
}
