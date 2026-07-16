// USB, Bluetooth, serial
import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

export async function runDevicesSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.devices) return [];
  const out: SensorSignal[] = [];

  const lsusb = await runCommand('lsusb', [], { timeoutMs: 5_000 });
  if (lsusb.code === 0) {
    for (const line of lsusb.stdout.split('\n').filter(Boolean)) {
      if (/Rubber Ducky|BadUSB|HID/i.test(line)) {
        out.push(signal('devices', 'Suspicious USB HID device', line.trim(), 8, 0.75, {
          evidence: { line: line.trim() },
        }));
      }
    }
  }

  // Newly mounted filesystems with noexec missing under /media|/mnt|/run/media
  const mounts = fs.existsSync('/proc/mounts') ? fs.readFileSync('/proc/mounts', 'utf8') : '';
  for (const line of mounts.split('\n')) {
    if (!/\/(media|mnt|run\/media)\//.test(line)) continue;
    if (!/\bnoexec\b/.test(line)) {
      out.push(signal('devices', 'Removable mount without noexec', line.trim().slice(0, 300), 5, 0.55));
    }
  }

  return out;
}
