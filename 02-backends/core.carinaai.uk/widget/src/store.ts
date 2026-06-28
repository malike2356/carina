const KEY = (workerId: string) => `carina_session_${workerId}`;

export function loadToken(workerId: string): string | null {
  try {
    return localStorage.getItem(KEY(workerId));
  } catch {
    return null;
  }
}

export function saveToken(workerId: string, token: string): void {
  try {
    localStorage.setItem(KEY(workerId), token);
  } catch {
    // storage unavailable
  }
}
