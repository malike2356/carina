export interface CredentialTrialCheck {
  allowed: boolean;
  error?: string;
}

export async function checkChannelCredentialForTrial(
  _channel: string,
  _identifier: string,
  _workspaceId: string,
): Promise<CredentialTrialCheck> {
  return { allowed: true };
}

export async function recordChannelCredentialTrial(
  _channel: string,
  _identifier: string,
  _workspaceId: string,
): Promise<void> {
  // no-op stub
}
