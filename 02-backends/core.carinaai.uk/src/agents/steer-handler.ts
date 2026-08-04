export interface SteerEvent {
  type: 'steer';
  entryId: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

export class SteerHandler {
  private activeTurns = new Map<string, AbortController>();
  private steerBuffer = new Map<string, SteerEvent>();

  registerTurn(sessionId: string, ac: AbortController): void {
    this.activeTurns.set(sessionId, ac);
  }

  unregisterTurn(sessionId: string): void {
    this.activeTurns.delete(sessionId);
  }

  inject(sessionId: string, steerEvent: SteerEvent): void {
    this.steerBuffer.set(sessionId, steerEvent);
  }

  getPendingSteer(sessionId: string): SteerEvent | undefined {
    const event = this.steerBuffer.get(sessionId);
    if (event) this.steerBuffer.delete(sessionId);
    return event;
  }

  abortSession(sessionId: string): void {
    const ac = this.activeTurns.get(sessionId);
    if (ac) {
      ac.abort();
      this.activeTurns.delete(sessionId);
    }
  }
}

let steerHandler: SteerHandler | null = null;

export function getSteerHandler(): SteerHandler {
  steerHandler ??= new SteerHandler();
  return steerHandler;
}
