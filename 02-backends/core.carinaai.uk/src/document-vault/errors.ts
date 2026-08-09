export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'conflict'
      | 'validation'
      | 'quota'
      | 'stale_revision'
      | 'approval_required'
      | 'cycle'
      | 'channel_unbound'
      | 'channel_revoked'
      | 'unsupported_channel'
      | 'malware_detected'
      | 'destination_required'
      | 'not_configured'
      | 'ssrf_blocked'
      | 'invalid_args',
  ) {
    super(message);
    this.name = 'VaultError';
  }
}
