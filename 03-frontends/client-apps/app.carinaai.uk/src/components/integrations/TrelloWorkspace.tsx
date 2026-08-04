'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { CarinaEditor } from '@/components/editor';

type Board = { id: string; name: string; url: string };
type List = { id: string; name: string };
type Card = {
  id: string;
  name: string;
  desc?: string;
  url: string;
  due?: string;
  start?: string;
  dueComplete?: boolean;
  closed?: boolean;
  labels?: Array<{ id: string; name: string; color?: string }>;
  members?: Array<{ id: string; fullName: string; username?: string }>;
  checklists?: Array<{
    id: string;
    name: string;
    checkItems: Array<{ id: string; name: string; state: 'complete' | 'incomplete'; due?: string }>;
  }>;
  attachments?: Array<{ id: string; name: string; url: string; mimeType?: string; date?: string }>;
  actions?: Array<{
    id: string;
    date: string;
    type: string;
    data?: { text?: string };
    memberCreator?: { fullName: string; username?: string };
  }>;
};

type SettingsStatus = {
  configured: boolean;
  source: 'stored' | 'env' | 'none';
  apiKeyMask?: string;
};

async function trelloApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export function TrelloWorkspace() {
  const [settings, setSettings] = useState<SettingsStatus | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [boardId, setBoardId] = useState('');
  const [listId, setListId] = useState('');
  const [cardId, setCardId] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [comment, setComment] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function loadSettings() {
    const data = await trelloApi<SettingsStatus>('/api/trello/settings');
    setSettings(data);
    return data.configured;
  }

  async function loadBoards() {
    const data = await trelloApi<{ boards: Board[] }>('/api/trello/boards');
    setBoards(data.boards);
    if (data.boards.length && !boardId) {
      await selectBoard(data.boards[0].id, data.boards);
    }
  }

  async function selectBoard(nextBoardId: string, boardRows = boards) {
    setBoardId(nextBoardId);
    setCardId('');
    setSelectedCard(null);
    setCards([]);
    const data = await trelloApi<{ lists: List[] }>(
      `/api/trello/boards/${encodeURIComponent(nextBoardId)}/lists`,
    );
    setLists(data.lists);
    const firstList = data.lists[0]?.id ?? '';
    setListId(firstList);
    if (firstList) await loadCards(firstList);
    setStatus(boardRows.find((b) => b.id === nextBoardId)?.name ?? 'Board selected');
  }

  async function loadCards(nextListId = listId) {
    if (!nextListId) {
      setCards([]);
      setSelectedCard(null);
      return;
    }
    const data = await trelloApi<{ cards: Card[] }>(
      `/api/trello/lists/${encodeURIComponent(nextListId)}/cards`,
    );
    setCards(data.cards);
  }

  async function selectCard(nextCardId: string) {
    setCardId(nextCardId);
    setCardLoading(true);
    setError(null);
    try {
      const data = await trelloApi<{ card: Card }>(
        `/api/trello/cards/${encodeURIComponent(nextCardId)}`,
      );
      setSelectedCard(data.card);
    } catch (err) {
      setSelectedCard(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCardLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const configured = await loadSettings();
        if (configured) await loadBoards();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCredentials(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await trelloApi<SettingsStatus>('/api/trello/settings', {
        method: 'PUT',
        body: JSON.stringify({ apiKey: apiKey.trim(), token: token.trim() }),
      });
      setSettings(data);
      setApiKey('');
      setToken('');
      setMessage('Trello credentials saved.');
      setShowCredentials(false);
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearCredentials() {
    if (!confirm('Remove saved Trello credentials for this workspace?')) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await trelloApi<SettingsStatus>('/api/trello/settings', { method: 'DELETE' });
      setSettings(data);
      setBoards([]);
      setLists([]);
      setCards([]);
      setMessage('Saved credentials removed.');
      setShowCredentials(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createCard() {
    if (!listId || !newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trelloApi('/api/trello/cards', {
        method: 'POST',
        body: JSON.stringify({ listId, name: newName.trim(), desc: newDesc.trim() }),
      });
      setNewName('');
      setNewDesc('');
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!cardId || !comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trelloApi(`/api/trello/cards/${encodeURIComponent(cardId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: comment.trim() }),
      });
      setComment('');
      await selectCard(cardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function archiveCard() {
    if (!cardId) return;
    setBusy(true);
    setError(null);
    try {
      await trelloApi(`/api/trello/cards/${encodeURIComponent(cardId)}/archive`, { method: 'POST' });
      setCardId('');
      setSelectedCard(null);
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function credentialsForm() {
    return (
      <form onSubmit={saveCredentials} className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-xs text-text-muted">
          Connect Trello to browse boards here and use the agent <code className="text-text-secondary">trello</code>{' '}
          tool in chat. Get your API key and token at{' '}
          <a
            href="https://trello.com/app-key"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover"
          >
            trello.com/app-key
          </a>
          .
        </p>
        <label className="block text-xs text-text-secondary">
          API key
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Trello API key"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Member token with read and write access"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save credentials'}
          </button>
          {settings?.configured && settings.source === 'stored' ? (
            <button
              type="button"
              onClick={() => void clearCredentials()}
              disabled={busy}
              className="rounded-md border border-border px-3 py-2 text-xs text-danger hover:bg-elevated disabled:opacity-50"
            >
              Remove saved credentials
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!settings?.configured) {
    return (
      <div className="mx-auto max-w-xl px-6 py-8">
        <Link
          href="/channels"
          className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All channels
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">Trello</h1>
        <p className="mt-1 text-xs text-text-muted">Browse boards and manage cards from Carina Cloud.</p>
        <div className="mt-6">{credentialsForm()}</div>
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        {message ? <p className="mt-3 text-xs text-emerald-400">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/channels"
              className="mb-2 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All channels
            </Link>
            <h1 className="text-base font-semibold text-text-primary">Trello</h1>
            <p className="text-xs text-text-muted">
              {status || 'Select a board and list'}
              {settings.apiKeyMask ? ` · Key ${settings.apiKeyMask}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCredentials((current) => !current)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
          >
            {showCredentials ? 'Hide credentials' : 'Manage credentials'}
          </button>
        </div>
        {showCredentials ? <div className="mt-4">{credentialsForm()}</div> : null}
      </div>

      {error ? <p className="px-6 py-2 text-xs text-danger">{error}</p> : null}
      {message ? <p className="px-6 py-2 text-xs text-emerald-400">{message}</p> : null}

      <div className="grid flex-1 gap-4 overflow-hidden p-6 lg:grid-cols-[240px_1fr_320px]">
        <section className="overflow-y-auto rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Boards</h2>
          <div className="space-y-2">
            {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => void selectBoard(board.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  board.id === boardId
                    ? 'border-accent bg-accent-dim text-text-primary'
                    : 'border-border text-text-secondary'
                }`}
              >
                {board.name}
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <select
              value={listId}
              aria-label="Trello list"
              onChange={(e) => {
                setListId(e.target.value);
                setCardId('');
                setSelectedCard(null);
                void loadCards(e.target.value);
              }}
              className="flex-1 rounded-md border border-border bg-elevated px-2 py-1.5 text-sm"
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadCards()}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-text-secondary"
            >
              Refresh
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => void selectCard(card.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  card.id === cardId ? 'border-accent bg-accent-dim' : 'border-border'
                }`}
              >
                <p className="text-sm text-text-primary">{card.name}</p>
                {card.due ? (
                  <p className="text-[11px] text-text-muted">Due {card.due.slice(0, 10)}</p>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Card details</h2>
          {!cardId ? <p className="text-xs text-text-muted">Select a card to open it.</p> : null}
          {cardLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading card details...
            </div>
          ) : null}
          {selectedCard && !cardLoading ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-text-primary">{selectedCard.name}</h3>
                  <a
                    href={selectedCard.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open card in Trello"
                    className="text-text-muted hover:text-accent"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-text-secondary">
                  {selectedCard.desc || 'No description'}
                </p>
              </div>
              {selectedCard.start || selectedCard.due ? (
                <div className="rounded-md bg-elevated p-2 text-text-secondary">
                  {selectedCard.start ? <p>Start: {new Date(selectedCard.start).toLocaleString()}</p> : null}
                  {selectedCard.due ? (
                    <p>
                      Due: {new Date(selectedCard.due).toLocaleString()}
                      {selectedCard.dueComplete ? ' (complete)' : ''}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selectedCard.labels?.length ? (
                <div>
                  <p className="mb-1 font-medium text-text-secondary">Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedCard.labels.map((label) => (
                      <span key={label.id} className="rounded bg-elevated px-2 py-1 text-text-secondary">
                        {label.name || label.color || 'Unnamed label'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedCard.members?.length ? (
                <div>
                  <p className="mb-1 font-medium text-text-secondary">Members</p>
                  <p className="text-text-secondary">
                    {selectedCard.members.map((member) => member.fullName || member.username).join(', ')}
                  </p>
                </div>
              ) : null}
              {selectedCard.checklists?.map((checklist) => (
                <div key={checklist.id}>
                  <p className="mb-1 font-medium text-text-secondary">{checklist.name}</p>
                  <div className="space-y-1">
                    {checklist.checkItems.map((item) => (
                      <p key={item.id} className="text-text-secondary">
                        <span className="mr-1 font-mono">{item.state === 'complete' ? '[x]' : '[ ]'}</span>
                        {item.name}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {selectedCard.attachments?.length ? (
                <div>
                  <p className="mb-1 font-medium text-text-secondary">Attachments</p>
                  <div className="space-y-1">
                    {selectedCard.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-accent hover:text-accent-hover"
                      >
                        <ExternalLink className="h-3 w-3" /> {attachment.name}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedCard.actions?.filter((action) => action.type === 'commentCard').length ? (
                <div>
                  <p className="mb-1 font-medium text-text-secondary">Comments</p>
                  <div className="space-y-2">
                    {selectedCard.actions
                      .filter((action) => action.type === 'commentCard')
                      .map((action) => (
                        <div key={action.id} className="rounded-md bg-elevated p-2">
                          <p className="font-medium text-text-secondary">
                            {action.memberCreator?.fullName || action.memberCreator?.username || 'Unknown member'}
                          </p>
                          <p className="whitespace-pre-wrap text-text-secondary">{action.data?.text}</p>
                          <p className="mt-1 text-[10px] text-text-muted">
                            {new Date(action.date).toLocaleString()}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2 border-t border-border pt-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Create card</h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New card title"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            />
            <CarinaEditor
              value={newDesc}
              onChange={setNewDesc}
              placeholder="Description"
              variant="compact"
              minHeight="5rem"
              showEngineSwitch={false}
            />
            <button
              type="button"
              onClick={() => void createCard()}
              disabled={busy}
              className="w-full rounded-md bg-accent px-3 py-2 text-xs text-primary-foreground"
            >
              Create card
            </button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Card actions</h2>
            <CarinaEditor
              value={comment}
              onChange={setComment}
              placeholder="Comment on selected card"
              variant="compact"
              minHeight="4rem"
              showEngineSwitch={false}
              showToolbar={false}
            />
            <button
              type="button"
              onClick={() => void addComment()}
              disabled={busy || !cardId}
              className="w-full rounded-md border border-border px-3 py-2 text-xs"
            >
              Add comment
            </button>
            <button
              type="button"
              onClick={() => void archiveCard()}
              disabled={busy || !cardId}
              className="w-full rounded-md border border-border px-3 py-2 text-xs text-danger"
            >
              Archive card
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
