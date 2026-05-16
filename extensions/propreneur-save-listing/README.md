# Propreneur Capture (browser extension)

Manifest V3 extension for Chromium (Chrome, Edge, Brave). Firefox may load temporarily from `manifest.json`.

## What it does

On a supported listing tab (Rightmove, Zoopla, OnTheMarket, OpenRent, SpareRoom), the popup injects a small content script that reads the DOM, builds an `import` payload (title, images, postcode, etc.), and POSTs it to your workspace `POST /api/deal-extension-capture` with your **Sanctum personal access token**. If DOM capture fails, you can still send the tab URL for server-side import (chain driver). If you already have a draft for that listing, the client can retry with `merge_listing_media: true` to merge gallery URLs.

## Install (developer / sideload)

1. In Propreneur, open **Deals → Sourcing → Browser extension** and create a personal API token.
2. **Chrome / Edge:** `chrome://extensions` → Developer mode → **Load unpacked** → select this folder.
3. Open **Extension options** (right-click the extension icon, or use the link in the popup) and set **Workspace API base URL** and **token**.

## Configure

1. **Options page:** workspace origin (e.g. `https://xelox.propreneur.test:8000`, no trailing slash) and API token. Save.
2. Open a listing on a supported portal, click the extension icon.
3. Review the preview, choose strategy, **Save to Propreneur**.

## Files

- `manifest.json` — MV3 manifest, portal `host_permissions`, broad http(s) for workspace API calls.
- `options.html` / `options.js` — workspace URL and token.
- `popup.html` / `popup.js` — preview, capture, save, duplicate merge retry.
- `content-scripts/shared.js` — helpers for extractors.
- `content-scripts/rightmove.js` (and zoopla, onthemarket, openrent, spareroom) — DOM snapshot payloads.
- `icons/` — toolbar icons.

## Packaging for stores

Zip this directory for Chrome Web Store / Edge Add-ons when ready; supply a privacy policy and justify broad `https://*/*` host permission or narrow it to your production tenant hostnames if policy requires.
