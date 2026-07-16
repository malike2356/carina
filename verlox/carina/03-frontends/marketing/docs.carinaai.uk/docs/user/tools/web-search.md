# Web Search

Runs a web search and returns ranked results for the model to cite. **Tavily** is the default provider (free tier).

## Requirements

```
TAVILY_API_KEY=tvly-...
```

Get a key at [tavily.com](https://tavily.com). New accounts get about **1,000 free API credits per month** (no card required).

Optional:

```
TAVILY_SEARCH_DEPTH=basic  # basic | advanced (advanced uses more credits)
SEARCH_PROVIDER=tavily  # default; use brave only if you pay for Brave Search
```

## Paid fallback (optional)

Brave Search is **not free** (~$5 per 1,000 queries at [brave.com/search/api](https://brave.com/search/api)). Only use it if you already have a subscription:

```
SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=...
```

## Security

- Queries go to Tavily (or Brave if configured) over HTTPS only.
- No local shell or file access.
- Scout logs each call when enabled.

## Example

> "Search for UK HMO licensing changes in Portsmouth 2025."

Carina calls `web-search` with a query string. You may see `[using web-search...]` while streaming.

## Response

Returns a JSON summary: titles, URLs, and snippets. The model synthesises an answer; always verify critical legal or financial facts against primary sources.
