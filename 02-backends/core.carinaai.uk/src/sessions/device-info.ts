/**
 * Parse user-agent into browser / OS labels for session UI and alerts.
 */
import type { DeviceInfo } from './types.js';

export function parseDeviceInfo(input: {
  userAgent?: string | null;
  ip?: string | null;
  location?: string | null;
  deviceLabel?: string | null;
}): DeviceInfo {
  const ua = String(input.userAgent ?? '').trim();
  let browser = 'Unknown browser';
  let os = 'Unknown OS';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (ua) browser = 'Browser';

  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const location = input.location?.trim() || 'Unknown location';
  const deviceLabel = input.deviceLabel?.trim() || `${browser} on ${os}`;
  return {
    userAgent: ua || null,
    ip: input.ip ?? null,
    deviceLabel,
    location,
    browser,
    os,
  };
}

export function formatNewLoginMessage(event: {
  browser: string;
  os: string;
  location: string;
}): string {
  return `New sign-in from ${event.browser} on ${event.os} in ${event.location}`;
}
