import * as crypto from 'crypto';
import { pool } from '../db.js';
import type { RotationConfig } from './deception-config.js';
import { DEFAULT_ROTATION_CONFIG } from './deception-config.js';

export interface Marker {
  value: string;
  rotatedAt: Date;
}

interface MarkerRow {
  marker_value: string;
  rotated_at: Date;
  retired_at: Date | null;
}

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class MovingTarget {
  private currentMarker: Marker;
  private previousMarkers: Marker[] = [];
  private toolNameMap: Map<string, string> = new Map();
  private reverseToolMap: Map<string, string> = new Map();
  private config: RotationConfig;

  constructor(config: Partial<RotationConfig> = {}) {
    this.config = { ...DEFAULT_ROTATION_CONFIG, ...config };
    this.currentMarker = { value: this.generateMarker(), rotatedAt: new Date() };
  }

  getCurrentMarker(): Marker {
    return this.currentMarker;
  }

  getPreviousMarkers(): Marker[] {
    return [...this.previousMarkers];
  }

  getCurrentToolName(realName: string): string {
    const existing = this.toolNameMap.get(realName);
    if (existing) return existing;

    const publicName = `tool_${randomFromAlphabet(12, ALPHANUM)}`;
    this.toolNameMap.set(realName, publicName);
    this.reverseToolMap.set(publicName, realName);
    return publicName;
  }

  resolveRealToolName(publicName: string): string | undefined {
    return this.reverseToolMap.get(publicName);
  }

  rotateToolNames(): void {
    this.toolNameMap.clear();
    this.reverseToolMap.clear();
  }

  async rotateMarker(): Promise<Marker> {
    const retired = { ...this.currentMarker };

    this.previousMarkers.unshift(retired);
    if (this.previousMarkers.length > 5) {
      this.previousMarkers = this.previousMarkers.slice(0, 5);
    }

    const newMarker: Marker = {
      value: this.generateMarker(),
      rotatedAt: new Date(),
    };
    this.currentMarker = newMarker;

    try {
      await pool.query(
        `INSERT INTO marker_rotations (marker_value, rotated_at)
         VALUES ($1, $2)`,
        [retired.value, retired.rotatedAt],
      );
    } catch {
      // Non-fatal: DB persistence failure should not break rotation
    }

    return newMarker;
  }

  async loadHistory(): Promise<void> {
    try {
      const result = await pool.query<MarkerRow>(
        `SELECT marker_value, rotated_at, retired_at
         FROM marker_rotations
         WHERE retired_at IS NULL
         ORDER BY rotated_at DESC
         LIMIT 5`,
      );

      if (result.rows.length > 0) {
        this.currentMarker = {
          value: result.rows[0]!.marker_value,
          rotatedAt: new Date(result.rows[0]!.rotated_at),
        };

        this.previousMarkers = result.rows.slice(1).map((row) => ({
          value: row.marker_value,
          rotatedAt: new Date(row.rotated_at),
        }));
      }
    } catch {
      // Start fresh if DB unavailable
    }
  }

  private generateMarker(): string {
    return randomFromAlphabet(4, ALPHANUM);
  }
}

function randomFromAlphabet(length: number, alphabet: string): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export const movingTarget = new MovingTarget();
