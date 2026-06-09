#!/usr/bin/env python3
"""Remove em dashes, en dashes, and emojis from first-party VERLOX files."""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKIP_DIRS = {
    'node_modules', 'vendor', 'dist', '.git', '.pnpm', '.turbo', 'coverage',
    '__pycache__', '.next', 'build', '.vitepress', 'standalone',
}
SKIP_FILE_SUFFIXES = ('.min.js', '.min.css', '.map', '.woff', '.woff2', '.png', '.jpg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip')
SKIP_PATH_SNIPPETS = (
    '/carinaai.uk/docs/',
    '/labyrinthscout.com/docs/',
    '/utf8.txt',
    '/surrogate_pair_bug.txt',
    '/tests.json',
)
TEXT_EXTENSIONS = {
    '.md', '.html', '.htm', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.php', '.json', '.yml', '.yaml', '.ejs', '.css', '.txt',
    '.vue', '.blade.php', '.xml', '.env.example', '.conf', '.ini', '.sql',
}
# Shell scripts are excluded: case/esac uses `;;` and must not be rewritten.

EMOJI_RE = re.compile(
    '['
    '\U0001F300-\U0001FAFF'
    '\U00002600-\U000027BF'
    '\U0001F600-\U0001F64F'
    '\U00002700-\U000027BF'
    '\U0000FE0F'
    '\U0000200D'
    ']+',
    re.UNICODE,
)

EMOJI_LABELS = {
    '\u2705': 'Done',
    '\u274c': 'Failed',
    '\u26a0\ufe0f': 'WARNING',
    '\u26a0': 'WARNING',
    '\u2139\ufe0f': 'Note',
    '\u2139': 'Note',
    '\u2728': '',
    '\U0001f41b': 'BUG',
    '\U0001f525': '',
    '\u2b50': '',
    '\u2728': '',
}


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIRS


def should_skip_path(path: str) -> bool:
    if any(snippet in path for snippet in SKIP_PATH_SNIPPETS):
        return True
    return path.endswith(SKIP_FILE_SUFFIXES)


def is_text_file(path: str) -> bool:
    if path.endswith('.blade.php'):
        return True
    _, ext = os.path.splitext(path)
    return ext in TEXT_EXTENSIONS


def replace_dashes(text: str) -> str:
    text = text.replace('&mdash;', ';')
    text = text.replace('&ndash;', '-')
    text = text.replace('\u2014', ';')  # em dash
    text = text.replace('\u2013', '-')  # en dash
    return text


def strip_emojis(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        value = match.group(0)
        label = EMOJI_LABELS.get(value)
        if label is None:
            return ''
        if label:
            return f'{label}: '
        return ''

    return EMOJI_RE.sub(repl, text)


def clean_text(text: str) -> str:
    text = replace_dashes(text)
    text = strip_emojis(text)
    text = re.sub(r'[ \t]+;', ';', text)
    text = re.sub(r';{2,}', ';', text)
    text = re.sub(r' ;', ';', text)
    text = re.sub(r'; +', '; ', text)
    return text


def iter_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for filename in filenames:
            path = os.path.join(dirpath, filename)
            if should_skip_path(path) or not is_text_file(path):
                continue
            yield path


def main() -> int:
    changed: list[str] = []
    for path in iter_files(ROOT):
        try:
            with open(path, 'r', encoding='utf-8') as handle:
                original = handle.read()
        except (UnicodeDecodeError, OSError):
            continue

        updated = clean_text(original)
        if updated != original:
            with open(path, 'w', encoding='utf-8', newline='') as handle:
                handle.write(updated)
            changed.append(path)

    print(f'Updated {len(changed)} files under {ROOT}')
    for path in changed[:40]:
        print(path)
    if len(changed) > 40:
        print(f'... and {len(changed) - 40} more')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
