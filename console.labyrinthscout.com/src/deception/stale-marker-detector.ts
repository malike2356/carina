import { alertDispatcher } from '../alerts/dispatcher.js';
import * as crypto from 'crypto';
import type { Marker, MovingTarget } from './moving-target.js';

export interface StaleMarkerResult {
  detected: boolean;
  matchedMarker?: string;
  rotationIndex?: number;
}

/**
 * Checks incoming user messages against retired markers.
 * A match on a marker retired 2+ rotations ago triggers a high-severity alert.
 */
export function checkIncomingMessage(
  message: string,
  mt: Pick<MovingTarget, 'getCurrentMarker' | 'getPreviousMarkers'>,
): StaleMarkerResult {
  const current = mt.getCurrentMarker().value;
  const previous = mt.getPreviousMarkers();

  // Current marker in user input is not an attack; it may appear in agent output
  if (message.includes(current)) {
    return { detected: false };
  }

  // Check retired markers
  for (let i = 0; i < previous.length; i++) {
    const marker = previous[i]!;
    if (message.includes(marker.value)) {
      // Markers 2+ rotations old are considered stale/attack
      if (i >= 1) {
        void alertDispatcher.dispatch({
          id: crypto.randomUUID(),
          instance_id: 'system',
          session_id: 'system',
          event_type: 'stale_marker_detected',
          severity: 'critical',
          description: `Stale marker detected in user input: rotation index ${i + 1}, marker was rotated at ${marker.rotatedAt.toISOString()}`,
          created_at: new Date(),
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
        });
      }
      return {
        detected: true,
        matchedMarker: marker.value,
        rotationIndex: i + 1,
      };
    }
  }

  return { detected: false };
}
