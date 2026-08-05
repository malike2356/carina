# Phase 2.5; Browser Automation Tools

## Task
Implement all 9 browser automation tools. These give Carina the ability to navigate web pages, interact with forms, read page content, execute JavaScript, and extract data.

## Tool List

### browser_navigate
Navigate to a URL. Initializes session and loads page.

Parameters:
- url (string, required): The URL to navigate to

Returns: Compact page snapshot with interactive elements and ref IDs (like @e1, @e2).
Note: For plain-text endpoints (.md, .txt, .json, .csv, .xml), prefer curl/terminal.
Must be called before other browser tools.

### browser_click
Click on an element identified by ref ID from snapshot.

Parameters:
- ref (string, required): Element reference (e.g., '@e5')

### browser_type
Type text into an input field. Clears field first, then types.

Parameters:
- ref (string, required): Element reference
- text (string, required): Text to type

### browser_press
Press a keyboard key. Useful for submitting forms (Enter), navigation (Tab), shortcuts (Escape).

Parameters:
- key (string, required): Key to press (Enter, Tab, Escape, ArrowDown)

### browser_scroll
Scroll the page to reveal more content.

Parameters:
- direction (enum: up|down, required)

### browser_snapshot
Get text-based accessibility tree snapshot of the current page.

Parameters:
- full (bool, default false): false = compact (interactive elements), true = complete page content

Returns: Snapshot of page content with ref IDs for interactive elements.
Snapshots over 8000 chars are truncated or summarized.

### browser_console
Get browser console output and JavaScript errors. Can also evaluate JS in page context.

Parameters:
- clear (bool, default false): Clear message buffers after reading
- expression (string, optional): JavaScript to evaluate in page context

Returns: Console messages (log, warn, error, info) and uncaught exceptions.
With expression: return value of the JS evaluation (serialized to JSON).

### browser_back
Navigate back to the previous page in browser history. Requires browser_navigate first.

### browser_get_images
Get list of all images on current page with URLs and alt text. Useful for finding images to analyze with vision tools.

## Implementation notes
- Use a headless browser (recommend Playwright or Puppeteer)
- Each tool call is synchronous (browser state persists between calls)
- Session management: one browser context per Carina session
- Stealth mode: inject common anti-detection scripts
- Timeout: 30s per browser operation
- Screenshot capability for debugging (optional but recommended)

## Security
- Block file:// protocol
- Block navigation to internal IPs (localhost, 127.0.0.1, 10.x, 192.168.x, 172.16-31.x)
- Log all URLs visited to Scout audit trail
- Cookie and storage isolation per session

## Verification
```bash
# Basic flow
browser_navigate: { url: "https://example.com" }
# Verify: returns page snapshot

browser_snapshot: { full: true }
# Verify: returns complete page content

browser_click: { ref: "@e3" }
# Verify: navigates or triggers action

browser_type: { ref: "@e5", text: "search query" }
browser_press: { key: "Enter" }
# Verify: form submitted

browser_console: { expression: "document.title" }
# Verify: returns page title

browser_get_images: {}
# Verify: returns array of { url, alt }
```
