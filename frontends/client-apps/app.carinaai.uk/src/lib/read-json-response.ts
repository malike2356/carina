export async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `${label} returned an empty response (HTTP ${response.status}). Check core proxy settings and try again.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`${label} returned non-JSON (HTTP ${response.status}): ${preview}`);
  }
}
