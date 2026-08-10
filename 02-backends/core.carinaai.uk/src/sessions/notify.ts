/**
 * Notify account owner of a new device login (email when available).
 */
export async function notifyNewDeviceLoginEmail(params: {
  toEmail: string;
  message: string;
  userId: string;
}): Promise<boolean> {
  try {
    // Best-effort; products may replace with Resend/SMTP adapters.
    console.info('[session-email]', params.userId, params.toEmail, params.message);
    return true;
  } catch {
    return false;
  }
}
