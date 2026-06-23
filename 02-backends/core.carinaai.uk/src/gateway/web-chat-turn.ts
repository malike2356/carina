export type ActiveTurn = {
  sessionId: string | null;
  turnId: string | null;
};

export type TurnDisposition = 'active' | 'abandoned' | 'superseded' | 'cancelled';

export type ChatTurn = {
  sessionId: string;
  turnId: string;
  fullText: string;
  disposition: TurnDisposition;
};

export function isActiveTurn(
  active: ActiveTurn,
  sessionId: string,
  turnId: string,
): boolean {
  return active.sessionId === sessionId && active.turnId === turnId;
}

export function thinkingIndicatorHtml(): string {
  return (
    '<span class="thinking-indicator" aria-label="Carina is thinking" role="status">' +
    '<span class="thinking-dot"></span>' +
    '<span class="thinking-dot"></span>' +
    '<span class="thinking-dot"></span>' +
    '</span>'
  );
}

export function isThinkingPlaceholder(content: string | null | undefined): boolean {
  return content === '...' || content === '' || content == null;
}

export function shouldPersistCompletedTurn(turn: ChatTurn): boolean {
  return (
    turn.fullText.trim().length > 0
    && (turn.disposition === 'active' || turn.disposition === 'abandoned')
  );
}

export function shouldUpdateDomForTurn(active: ActiveTurn, turn: ChatTurn): boolean {
  return turn.disposition === 'active' && isActiveTurn(active, turn.sessionId, turn.turnId);
}

export class ChatTurnRegistry {
  private active: ActiveTurn = { sessionId: null, turnId: null };
  private turns = new Map<string, ChatTurn>();

  getActiveTurn(): ActiveTurn {
    return { ...this.active };
  }

  getTurn(turnId: string): ChatTurn | undefined {
    const turn = this.turns.get(turnId);
    return turn ? { ...turn } : undefined;
  }

  beginTurn(sessionId: string, turnId: string): void {
    if (this.active.turnId) {
      this.supersedeTurn(this.active.turnId);
    }
    this.active = { sessionId, turnId };
    this.turns.set(turnId, {
      sessionId,
      turnId,
      fullText: '',
      disposition: 'active',
    });
  }

  supersedeTurn(turnId: string): void {
    const turn = this.turns.get(turnId);
    if (!turn || turn.disposition !== 'active') return;
    turn.disposition = 'superseded';
    if (this.active.turnId === turnId) {
      this.active = { sessionId: null, turnId: null };
    }
  }

  abandonTurn(turnId: string): void {
    const turn = this.turns.get(turnId);
    if (!turn || turn.disposition !== 'active') return;
    turn.disposition = 'abandoned';
    if (this.active.turnId === turnId) {
      this.active = { sessionId: null, turnId: null };
    }
  }

  cancelTurn(turnId: string): ChatTurn | undefined {
    const turn = this.turns.get(turnId);
    if (!turn) return undefined;
    turn.disposition = 'cancelled';
    if (this.active.turnId === turnId) {
      this.active = { sessionId: null, turnId: null };
    }
    return { ...turn };
  }

  recordChunk(turnId: string, chunk: string): ChatTurn | null {
    const turn = this.turns.get(turnId);
    if (!turn) return null;
    if (turn.disposition === 'cancelled' || turn.disposition === 'superseded') {
      return null;
    }
    turn.fullText += chunk;
    return { ...turn };
  }

  completeTurn(turnId: string): ChatTurn | null {
    const turn = this.turns.get(turnId);
    if (!turn) return null;
    const snapshot = { ...turn };
    this.turns.delete(turnId);
    if (this.active.turnId === turnId) {
      this.active = { sessionId: null, turnId: null };
    }
    return snapshot;
  }

  shouldAcceptStreamEvent(sessionId: string, turnId: string): boolean {
    const turn = this.turns.get(turnId);
    if (!turn || turn.sessionId !== sessionId) return false;
    return turn.disposition === 'active' || turn.disposition === 'abandoned';
  }

  shouldUpdateDom(turnId: string): boolean {
    return this.active.turnId === turnId;
  }
}
