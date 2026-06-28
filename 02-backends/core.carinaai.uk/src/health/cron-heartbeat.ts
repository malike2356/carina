import fs from 'fs/promises';
import path from 'path';

const HEARTBEAT_PATH = process.env.CRON_HEARTBEAT_PATH?.trim() || '/var/log/verlox/cron-heartbeat.epoch';

export async function writeCronHeartbeat(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(HEARTBEAT_PATH), { recursive: true });
    await fs.writeFile(HEARTBEAT_PATH, String(Math.floor(Date.now() / 1000)));
  } catch (err) {
    console.warn('[cron-heartbeat] write failed:', err);
  }
}

export function startCronHeartbeatWriter(): void {
  void writeCronHeartbeat();
  setInterval(() => {
    void writeCronHeartbeat();
  }, 300_000).unref();
}
