(function () {
  const statusEl = document.getElementById('status');
  const boardsEl = document.getElementById('boards');
  const cardsEl = document.getElementById('cards');
  const listSelectEl = document.getElementById('list-select');
  const refreshBtn = document.getElementById('refresh-btn');
  const detailEl = document.getElementById('card-detail');
  const newNameEl = document.getElementById('new-name');
  const newDescEl = document.getElementById('new-desc');
  const commentEl = document.getElementById('comment-text');
  const createBtn = document.getElementById('create-card-btn');
  const commentBtn = document.getElementById('comment-btn');
  const archiveBtn = document.getElementById('archive-btn');

  const state = {
    boards: [],
    lists: [],
    cards: [],
    boardId: '',
    listId: '',
    cardId: '',
    card: null,
  };

  function setStatus(text, error) {
    statusEl.textContent = text;
    statusEl.className = error ? 'status error' : 'status';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function activeBoard() {
    return state.boards.find((board) => board.id === state.boardId) || null;
  }

  function activeList() {
    return state.lists.find((list) => list.id === state.listId) || null;
  }

  function activeCard() {
    return state.cards.find((card) => card.id === state.cardId) || null;
  }

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  function renderBoards() {
    if (!state.boards.length) {
      boardsEl.innerHTML = '<div class="empty">No boards available.</div>';
      return;
    }
    boardsEl.innerHTML = state.boards.map((board) => (
      '<button type="button" class="item' + (board.id === state.boardId ? ' active' : '') + '" data-board="' + board.id + '">' +
        '<strong>' + escapeHtml(board.name) + '</strong>' +
        '<div class="meta">' + escapeHtml(board.id) + '</div>' +
      '</button>'
    )).join('');
    boardsEl.querySelectorAll('[data-board]').forEach((el) => {
      el.addEventListener('click', () => {
        const boardId = el.getAttribute('data-board');
        if (boardId) selectBoard(boardId);
      });
    });
  }

  function renderLists() {
    listSelectEl.innerHTML = state.lists.map((list) => (
      '<option value="' + escapeHtml(list.id) + '"' + (list.id === state.listId ? ' selected' : '') + '>' +
        escapeHtml(list.name) +
      '</option>'
    )).join('');
    if (!state.lists.length) {
      listSelectEl.innerHTML = '<option value="">No lists</option>';
    }
  }

  function renderCards() {
    if (!state.cards.length) {
      cardsEl.innerHTML = '<div class="empty">No cards on this list.</div>';
      return;
    }
    cardsEl.innerHTML = state.cards.map((card) => (
      '<button type="button" class="card' + (card.id === state.cardId ? ' active' : '') + '" data-card="' + card.id + '">' +
        '<h3>' + escapeHtml(card.name) + '</h3>' +
        '<div class="meta">' + escapeHtml(card.id) + (card.due ? ' · due ' + escapeHtml(card.due.slice(0, 10)) : '') + '</div>' +
        '<div class="small">' + escapeHtml(card.desc || '') + '</div>' +
      '</button>'
    )).join('');
    cardsEl.querySelectorAll('[data-card]').forEach((el) => {
      el.addEventListener('click', () => {
        const cardId = el.getAttribute('data-card');
        if (cardId) selectCard(cardId);
      });
    });
  }

  function renderDetail() {
    const card = activeCard();
    if (!card) {
      detailEl.innerHTML = '<div class="empty">Select a card to inspect or update it.</div>';
      return;
    }
    detailEl.innerHTML = [
      '<div><strong>' + escapeHtml(card.name) + '</strong></div>',
      '<div class="small">ID: ' + escapeHtml(card.id) + '</div>',
      '<div class="small">List: ' + escapeHtml(card.idList || '') + '</div>',
      '<div class="small">Due: ' + escapeHtml(card.due || 'none') + '</div>',
      '<div class="small" style="margin-top:8px;white-space:pre-wrap">' + escapeHtml(card.desc || '(no description)') + '</div>',
      '<div class="small" style="margin-top:8px;"><a href="' + escapeHtml(card.url) + '" target="_blank" rel="noreferrer" style="color:#58a6ff">Open in Trello</a></div>',
    ].join('');
  }

  async function loadBoards() {
    setStatus('Loading boards...');
    const data = await api('/api/trello/boards');
    state.boards = Array.isArray(data.boards) ? data.boards : [];
    if (!state.boardId && state.boards.length) {
      state.boardId = state.boards[0].id;
    }
    renderBoards();
    await loadLists();
  }

  async function loadLists() {
    const board = activeBoard();
    if (!board) {
      state.lists = [];
      state.cards = [];
      state.card = null;
      renderBoards();
      renderLists();
      renderCards();
      renderDetail();
      setStatus('No board selected.', true);
      return;
    }
    setStatus('Loading lists for ' + board.name + '...');
    const data = await api('/api/trello/boards/' + encodeURIComponent(board.id) + '/lists');
    state.lists = Array.isArray(data.lists) ? data.lists : [];
    if (!state.listId || !state.lists.some((list) => list.id === state.listId)) {
      state.listId = state.lists[0] ? state.lists[0].id : '';
    }
    renderBoards();
    renderLists();
    await loadCards();
  }

  async function loadCards() {
    const list = activeList();
    if (!list) {
      state.cards = [];
      state.cardId = '';
      state.card = null;
      renderCards();
      renderDetail();
      setStatus('No list selected.', true);
      return;
    }
    setStatus('Loading cards for ' + list.name + '...');
    const data = await api('/api/trello/lists/' + encodeURIComponent(list.id) + '/cards');
    state.cards = Array.isArray(data.cards) ? data.cards : [];
    if (!state.cardId || !state.cards.some((card) => card.id === state.cardId)) {
      state.cardId = state.cards[0] ? state.cards[0].id : '';
    }
    state.card = state.cards.find((card) => card.id === state.cardId) || null;
    renderCards();
    renderDetail();
    setStatus('Showing ' + state.cards.length + ' cards on ' + list.name + '.');
  }

  async function selectBoard(boardId) {
    state.boardId = boardId;
    state.listId = '';
    state.cardId = '';
    renderBoards();
    await loadLists();
  }

  async function selectList(listId) {
    state.listId = listId;
    state.cardId = '';
    renderLists();
    await loadCards();
  }

  async function selectCard(cardId) {
    state.cardId = cardId;
    const card = state.cards.find((item) => item.id === cardId);
    state.card = card || null;
    renderCards();
    renderDetail();
  }

  listSelectEl.addEventListener('change', () => {
    if (listSelectEl.value) {
      selectList(listSelectEl.value);
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadBoards().catch((err) => setStatus(err.message, true));
  });

  createBtn.addEventListener('click', async () => {
    const listId = state.listId;
    const name = newNameEl.value.trim();
    const desc = newDescEl.value.trim();
    if (!listId || !name) {
      setStatus('Pick a list and enter a title.', true);
      return;
    }
    createBtn.disabled = true;
    try {
      await api('/api/trello/cards', {
        method: 'POST',
        body: JSON.stringify({ listId, name, desc }),
      });
      newNameEl.value = '';
      newDescEl.value = '';
      await loadCards();
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      createBtn.disabled = false;
    }
  });

  commentBtn.addEventListener('click', async () => {
    const cardId = state.cardId;
    const text = commentEl.value.trim();
    if (!cardId || !text) {
      setStatus('Pick a card and enter a comment.', true);
      return;
    }
    commentBtn.disabled = true;
    try {
      await api('/api/trello/cards/' + encodeURIComponent(cardId) + '/comments', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      commentEl.value = '';
      setStatus('Comment added.', false);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      commentBtn.disabled = false;
    }
  });

  archiveBtn.addEventListener('click', async () => {
    const cardId = state.cardId;
    if (!cardId) {
      setStatus('Pick a card to archive.', true);
      return;
    }
    archiveBtn.disabled = true;
    try {
      await api('/api/trello/cards/' + encodeURIComponent(cardId) + '/archive', {
        method: 'POST',
      });
      await loadCards();
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      archiveBtn.disabled = false;
    }
  });

  loadBoards().catch((err) => setStatus(err.message, true));
})();
