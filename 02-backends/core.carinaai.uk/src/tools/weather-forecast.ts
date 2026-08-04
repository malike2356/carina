import type { Tool } from '../types/index.js';
import { registerSessionTool } from './session-tool-store.js';

interface GeoHit {
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  admin1?: string;
  timezone?: string;
}

function pickCity(hits: GeoHit[], country?: string): GeoHit | null {
  if (!hits.length) return null;
  const cc = country?.trim().toUpperCase();
  if (cc) {
    const match = hits.find((h) => String(h.country_code ?? '').toUpperCase() === cc);
    if (match) return match;
  }
  return hits[0] ?? null;
}

/**
 * Lightweight Open-Meteo forecast (no API key). Always available in Aiva sessions
 * so morning digests work without core-engineering / http-request.
 */
export function createWeatherForecastTool(): Tool {
  return {
    name: 'weather-forecast',
    description:
      'Get current weather and a short daily forecast via Open-Meteo (no API key). '
      + 'Prefer this over http-request for weather briefings.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, e.g. Portsmouth' },
        country: {
          type: 'string',
          description: 'Optional ISO country code, e.g. GB',
        },
        days: {
          type: 'number',
          description: 'Forecast days (1-3). Default 1.',
        },
      },
      required: ['city'],
    },
    execute: async (params) => {
      const city = String(params.city ?? '').trim();
      if (!city) return { ok: false, error: 'city required' };
      const country = typeof params.country === 'string' ? params.country.trim() : '';
      const days = Math.min(3, Math.max(1, Number(params.days ?? 1) || 1));

      try {
        const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geoUrl.searchParams.set('name', city);
        geoUrl.searchParams.set('count', '5');
        geoUrl.searchParams.set('language', 'en');
        geoUrl.searchParams.set('format', 'json');
        const geoRes = await fetch(geoUrl.toString(), { signal: AbortSignal.timeout(12_000) });
        if (!geoRes.ok) {
          return { ok: false, error: `geocoding failed (${geoRes.status})` };
        }
        const geoJson = await geoRes.json() as { results?: GeoHit[] };
        const hit = pickCity(geoJson.results ?? [], country || undefined);
        if (!hit?.latitude || !hit?.longitude) {
          return { ok: false, error: `No location found for "${city}"` };
        }

        const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
        forecastUrl.searchParams.set('latitude', String(hit.latitude));
        forecastUrl.searchParams.set('longitude', String(hit.longitude));
        forecastUrl.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
        forecastUrl.searchParams.set(
          'daily',
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        );
        forecastUrl.searchParams.set('forecast_days', String(days));
        forecastUrl.searchParams.set('timezone', hit.timezone || 'auto');

        const forecastRes = await fetch(forecastUrl.toString(), {
          signal: AbortSignal.timeout(12_000),
        });
        if (!forecastRes.ok) {
          return { ok: false, error: `forecast failed (${forecastRes.status})` };
        }
        const forecast = await forecastRes.json() as Record<string, unknown>;

        return {
          ok: true,
          location: {
            name: hit.name,
            admin1: hit.admin1,
            country: hit.country_code,
            latitude: hit.latitude,
            longitude: hit.longitude,
            timezone: hit.timezone,
          },
          current: forecast.current ?? null,
          daily: forecast.daily ?? null,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export function registerWeatherForecastSessionTool(sessionId: string): void {
  registerSessionTool(sessionId, createWeatherForecastTool());
}
