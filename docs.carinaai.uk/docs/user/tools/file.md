# File Tools

Two tools: `file-read` and `file-write`.

## file-read

Reads text files up to **100 KB** (truncated with a notice if larger).

### Security

- Paths expanded from `~` to the user home directory.
- Blocks `..` traversal and sensitive system locations.
- With Scout: honeypot paths return `[Access Denied: This path is monitored by Labyrinth]`.

### Example

> "Read ~/projects/deal-sheet.txt and summarise the refurb budget."

## file-write

Creates or overwrites files.

### Security

- Cannot write to blocked system paths (`/etc`, `/usr`, etc.).
- **Confirmation required** when the target file already exists.
- Honeypot path checks when Scout is enabled.

### Example

> "Save this yield table to ~/carina-output/yields.md"

Carina asks for confirmation before overwriting an existing file.

## Returns

Plain text content for reads; success message or error string for writes.
