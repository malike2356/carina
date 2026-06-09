import type { Tool } from '../types/index.js';

async function spotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN ?? '';
  if (!clientId || !clientSecret || !refresh) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function spotifyFetch(path: string, method: 'GET' | 'PUT' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
  const token = await spotifyToken();
  if (!token) return { error: 'Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN' };

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

export const spotifySearchTool: Tool = {
  name: 'spotify-search',
  description: 'Search Spotify tracks, albums, artists, or playlists.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      type: { type: 'string', enum: ['track', 'album', 'artist', 'playlist'], description: 'Default: track' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const q = encodeURIComponent(String(params.query ?? ''));
    const type = String(params.type ?? 'track');
    const limit = Math.min(Number(params.limit ?? 10), 50);
    return spotifyFetch(`/search?q=${q}&type=${type}&limit=${limit}`);
  },
};

export const spotifyNowPlayingTool: Tool = {
  name: 'spotify-now-playing',
  description: 'Get the currently playing Spotify track for the authenticated user.',
  parameters: { type: 'object', properties: {} },
  execute: async () => spotifyFetch('/me/player/currently-playing'),
};

export const spotifyPlayTool: Tool = {
  name: 'spotify-play',
  description: 'Start or resume Spotify playback. Optionally play a track URI or context URI.',
  parameters: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'Spotify URI (spotify:track:... or spotify:playlist:...)' },
      device_id: { type: 'string' },
    },
  },
  requiresConfirmation: true,
  execute: async (params) => {
    const device = params.device_id ? `?device_id=${encodeURIComponent(String(params.device_id))}` : '';
    const body = params.uri ? { uris: [String(params.uri)] } : undefined;
    return spotifyFetch(`/me/player/play${device}`, 'PUT', body);
  },
};
