import { pool } from '../event-server/db.js';
import { getRedis } from '../event-server/redis.js';
import { broadcastEvent } from '../event-server/api/sse.js';
import { createControlService } from './control.js';

let controlServiceInstance: ReturnType<typeof createControlService> | null = null;

export function getControlService() {
  if (!controlServiceInstance) {
    controlServiceInstance = createControlService({
      pool,
      getRedis,
      broadcastEvent,
      now: () => new Date(),
    });
  }
  return controlServiceInstance;
}

