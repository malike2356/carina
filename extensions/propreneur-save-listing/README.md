# Propreneur: Save listing (browser extension)

Manifest V3 extension for Chromium (Chrome, Edge, Brave) and Firefox (temporary load).

## What it does

While you view a property listing in your browser, click the extension and it POSTs the **current tab URL** to your workspace `POST /api/deal-extension-capture` with your **Sanctum personal access token**. The server runs the same listing import as the in-app URL paste flow and creates a **draft** deal for your user. You are the one loading the page; this is not an unmanned crawl of the portal.

## Install (developer / sideload)

1. In Propreneur, open **Deals → Manual search → Browser extension** (or **Deals → Sourcing → Browser extension**) and create an API token.
2. **Chrome / Edge:** `chrome://extensions` → Developer mode → **Load unpacked** → select this folder.
3. **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → choose `manifest.json`.

## Configure

1. Open the extension popup.
2. **Workspace API base URL:** full origin of your tenant site, e.g. `https://xelox.propreneur.test:8000` (no trailing slash).
3. **API token:** paste the token shown once when you created it in Propreneur.
4. Choose strategy and click **Remember settings**.
5. Open a supported listing page in a tab, then click **Save current tab**.

## Optional: send a pre-built import payload

Advanced integrations can POST JSON with an `import` object (same shape as a successful `ListingImportService` response) instead of `url`. The extension UI only sends `url` by default.

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.js` — popup UI and fetch logic.

## Packaging for stores

Zip this directory for Chrome Web Store / Edge Add-ons review when you are ready; update `manifest.json` with icons, privacy policy URL, and a stable extension id for stricter CORS if you move off `Access-Control-Allow-Origin: *`.
