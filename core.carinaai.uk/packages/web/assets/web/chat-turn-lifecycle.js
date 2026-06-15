(function (root) {
  function isActiveTurn(active, sessionId, turnId) {
    return active.sessionId === sessionId && active.turnId === turnId;
  }

  function shouldPersistCompletedTurn(turn) {
    return turn.fullText.trim().length > 0
      && (turn.disposition === 'active' || turn.disposition === 'abandoned');
  }

  function shouldUpdateDomForTurn(active, turn) {
    return turn.disposition === 'active' && isActiveTurn(active, turn.sessionId, turn.turnId);
  }

  function ChatTurnRegistry() {
    this.active = { sessionId: null, turnId: null };
    this.turns = new Map();
  }

  ChatTurnRegistry.prototype.getActiveTurn = function () {
    return { sessionId: this.active.sessionId, turnId: this.active.turnId };
  };

  ChatTurnRegistry.prototype.beginTurn = function (sessionId, turnId) {
    if (this.active.turnId) this.supersedeTurn(this.active.turnId);
    this.active = { sessionId: sessionId, turnId: turnId };
    this.turns.set(turnId, {
      sessionId: sessionId,
      turnId: turnId,
      fullText: '',
      disposition: 'active',
    });
  };

  ChatTurnRegistry.prototype.supersedeTurn = function (turnId) {
    const turn = this.turns.get(turnId);
    if (!turn || turn.disposition !== 'active') return;
    turn.disposition = 'superseded';
    if (this.active.turnId === turnId) this.active = { sessionId: null, turnId: null };
  };

  ChatTurnRegistry.prototype.abandonTurn = function (turnId) {
    const turn = this.turns.get(turnId);
    if (!turn || turn.disposition !== 'active') return;
    turn.disposition = 'abandoned';
    if (this.active.turnId === turnId) this.active = { sessionId: null, turnId: null };
  };

  ChatTurnRegistry.prototype.cancelTurn = function (turnId) {
    const turn = this.turns.get(turnId);
    if (!turn) return undefined;
    turn.disposition = 'cancelled';
    if (this.active.turnId === turnId) this.active = { sessionId: null, turnId: null };
    return {
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      fullText: turn.fullText,
      disposition: turn.disposition,
    };
  };

  ChatTurnRegistry.prototype.recordChunk = function (turnId, chunk) {
    const turn = this.turns.get(turnId);
    if (!turn) return null;
    if (turn.disposition === 'cancelled' || turn.disposition === 'superseded') return null;
    turn.fullText += chunk;
    return {
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      fullText: turn.fullText,
      disposition: turn.disposition,
    };
  };

  ChatTurnRegistry.prototype.completeTurn = function (turnId) {
    const turn = this.turns.get(turnId);
    if (!turn) return null;
    const snapshot = {
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      fullText: turn.fullText,
      disposition: turn.disposition,
    };
    this.turns.delete(turnId);
    if (this.active.turnId === turnId) this.active = { sessionId: null, turnId: null };
    return snapshot;
  };

  ChatTurnRegistry.prototype.shouldAcceptStreamEvent = function (sessionId, turnId) {
    const turn = this.turns.get(turnId);
    if (!turn || turn.sessionId !== sessionId) return false;
    return turn.disposition === 'active' || turn.disposition === 'abandoned';
  };

  ChatTurnRegistry.prototype.shouldUpdateDom = function (turnId) {
    return this.active.turnId === turnId;
  };

  root.CarinaChatTurn = {
    ChatTurnRegistry: ChatTurnRegistry,
    shouldPersistCompletedTurn: shouldPersistCompletedTurn,
    shouldUpdateDomForTurn: shouldUpdateDomForTurn,
    isActiveTurn: isActiveTurn,
  };
})(window);
