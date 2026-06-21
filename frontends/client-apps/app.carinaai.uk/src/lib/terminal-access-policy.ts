export type TerminalAccessInput = {
  terminalEnabled: boolean;
  isOwner: boolean;
  memberTerminal?: boolean;
};

export function evaluateTerminalAccess(input: TerminalAccessInput): boolean {
  if (!input.terminalEnabled) return false;
  if (input.isOwner) return true;
  return input.memberTerminal === true;
}
