# Web Search

Runs a Brave Search API query and returns ranked results for the model to cite.

## Requirements

```
BRAVE_SEARCH_API_KEY=...
```

Without a key, the tool is not registered and Carina cannot search the web.

## Security

- Queries go to Brave over HTTPS only.
- No local shell or file access.
- Scout logs each call when enabled.

## Example

> "Search for UK HMO licensing changes in Portsmouth 2025."

Carina calls `web-search` with a query string. You may see `[using web-search...]` while streaming.

## Response

Returns a JSON summary: titles, URLs, and snippets. The model synthesises an answer; always verify critical legal or financial facts against primary sources.
