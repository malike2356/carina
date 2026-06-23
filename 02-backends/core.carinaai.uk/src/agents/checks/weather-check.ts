import type { CheckResult } from './email-check.js';

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

export function getConfiguredWeatherLocation(): WeatherLocation | null {
  const latitude = Number(process.env.CARINA_WEATHER_LATITUDE ?? '');
  const longitude = Number(process.env.CARINA_WEATHER_LONGITUDE ?? '');
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: process.env.CARINA_WEATHER_LABEL,
  };
}

export async function checkWeather(location = getConfiguredWeatherLocation()): Promise<CheckResult> {
  if (!location) {
    return { name: 'weather', urgent: false, summary: null };
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,precipitation,wind_speed_10m');
  url.searchParams.set('daily', 'precipitation_sum,wind_speed_10m_max');
  url.searchParams.set('forecast_days', '1');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }
  const data = await response.json() as {
    current?: {
      temperature_2m?: number;
      precipitation?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      precipitation_sum?: number[];
      wind_speed_10m_max?: number[];
    };
  };

  const current = data.current ?? {};
  const rain = data.daily?.precipitation_sum?.[0] ?? current.precipitation ?? 0;
  const wind = data.daily?.wind_speed_10m_max?.[0] ?? current.wind_speed_10m ?? 0;
  const urgent = rain >= 20 || wind >= 50;
  const place = location.label ? `${location.label} ` : '';

  return {
    name: 'weather',
    urgent,
    summary: `${place}weather: ${current.temperature_2m ?? 'unknown'}C, ${rain}mm rain today, max wind ${wind}km/h.`,
  };
}
