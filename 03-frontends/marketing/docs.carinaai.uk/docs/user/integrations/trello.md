# Trello integration

Carina connects to Trello for board browsing, card management, and agent tool calls (`trello` tool). Use the web workspace at `/trello` or ask Carina in chat to list boards, create cards, move cards, and add comments.

## Prerequisites

- A Trello account with access to the boards you need.
- API key and token from [trello.com/app-key](https://trello.com/app-key).

## Setup (web UI)

1. Open **Trello** in the Carina workspace sidebar (`/trello`), or go to **Settings** on Carina Cloud.
2. Under **Trello integration**, paste your **API key** and **token**.
3. Click **Save credentials**. Keys are encrypted at rest on the server.
4. Reload the Trello page; your boards should appear.

On a private/self-hosted install you can also set credentials in `.env` (see below). Stored credentials in the UI take precedence over environment variables for that scope.

## Setup (.env)

Add to `~/.carina/.env` or your Docker env file:

```
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token
# TRELLO_BASE_URL=https://api.trello.com/1
```

Restart Carina after changing env vars.

### Generate a token

1. Open [trello.com/app-key](https://trello.com/app-key) and copy the **API key**.
2. Click the token link on that page and approve **read** and **write** access.
3. Copy the token string.

## Agent tool

The `trello` tool supports:

| Action | Purpose |
|---|---|
| `list-boards` | List boards for the authenticated member |
| `list-lists` | Lists on a board (`boardId`) |
| `list-cards` | Cards in a list (`listId`) |
| `get-card` | Card detail (`cardId`) |
| `create-card` | New card (`listId`, `name`, optional `desc`) |
| `move-card` | Move card to another list (`cardId`, `listId`) |
| `add-comment` | Comment on a card (`cardId`, `text`) |
| `archive-card` | Archive a card (`cardId`) |

Write actions require confirmation in chat when tool confirmation is enabled.

### Example prompts

> List my Trello boards and open the cards in the first list on my Operations board.

> Create a Trello card titled "Follow up viewing" in list `abc123` with a short description.

## Web workspace

`/trello` provides a three-column UI: boards, cards in the selected list, and card detail with create/comment/archive actions. Available on **Carina Cloud** and **private** installs when credentials are configured.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TRELLO_API_KEY` | Yes (or UI) | Trello REST API key |
| `TRELLO_TOKEN` | Yes (or UI) | Member token with board access |
| `TRELLO_BASE_URL` | No | API base (default `https://api.trello.com/1`) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Trello is not configured` | Add credentials in `/trello`, Settings, or `.env` |
| HTTP 401 from Trello | Regenerate token; confirm read/write scopes |
| Empty board list | Token must be for the member that owns or joined the boards |
| Tool works but `/trello` is empty | Refresh after saving credentials; check browser network tab for `/api/trello/boards` |
