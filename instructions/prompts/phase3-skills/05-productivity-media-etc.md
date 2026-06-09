# Phase 3.5 — Productivity + Media + Email + Smart Home + Social + Note-taking + Red-teaming + Memory Skills

## Task
Port ALL remaining skill categories — every single Hermes skill except gaming. Carina is for serious business. No games, no gaming, no Minecraft, no Pokemon. Everything else must be ported.

## Productivity
- **airtable**: Airtable REST API — records CRUD, filters, upserts
- **client-proposals**: Write client-facing proposals, follow-ups, and scope documentation
- **event-debrief**: Process event transcripts, recordings, and slides
- **google-workspace**: Gmail, Calendar, Drive, Docs, Sheets via gws CLI or Python
- **laud-agent-bridge**: Communicate between Carina and OpenClaw agents
- **laud-data-environment**: Find and search Laud's data across all storage locations
- **linear**: Linear — manage issues, projects, teams via GraphQL
- **maps**: Geocode, POIs, routes, timezones via OpenStreetMap/OSRM
- **nano-pdf**: Edit PDF text/typos/titles via nano-pdf CLI (NL prompts)
- **notion**: Notion API + ntn CLI — pages, databases, markdown, Workers
- **ocr-and-documents**: Extract text from PDFs/scans (pymupdf, marker-pdf)
- **powerpoint**: Create, read, edit .pptx decks, slides, notes, templates
- **teams-meeting-pipeline**: Teams meeting summary pipeline
- **working-with-laud**: How to work effectively with Laud

## Media
- **gif-search**: Search/download GIFs from Tenor via curl + jq
- **heartmula**: Suno-like song generation from lyrics + tags
- **songsee**: Audio spectrograms/features (mel, chroma, MFCC) via CLI
- **spotify**: Spotify — play, search, queue, manage playlists and devices
- **youtube-content**: YouTube transcripts to summaries, threads, blogs

## Email
- **himalaya**: Himalaya CLI — IMAP/SMTP email from terminal

## Smart Home
- **openhue**: Control Philips Hue lights, scenes, rooms via OpenHue CLI

## Social Media
- **xurl**: X/Twitter via xurl CLI — post, search, DM, media, v2 API

## Note-taking
- **obsidian**: Read, search, create, and edit notes in the Obsidian vault

## Red-teaming
- **godmode**: Jailbreak LLMs — Parseltongue, GODMODE, ULTRAPLINIAN techniques

## Memory Consolidation
- **memory-consolidation**: Efficiently manage memory entries when approaching size limits

## Dogfood
- **dogfood**: Exploratory QA of web apps — find bugs, gather evidence, produce reports

## Porting instructions
Skills requiring API keys (Spotify, Notion, Airtable, Google, X/Twitter) must:
1. Check for credentials at startup
2. Guide user through setup if missing
3. Never hardcode tokens — read from env/config

Smart home skills need network access to Hue bridge.
