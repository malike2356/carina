#!/usr/bin/env python3
"""Flatten legacy boxed Tailwind patterns in ops EJS views."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEWS = ROOT / 'views'
SKIP = {'layout.ejs', 'login.ejs', 'tui.ejs'}

REPLACEMENTS = [
    ('bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden', 'ops-surface ops-table-wrap'),
    ('overflow-x-auto border border-[#2a2a2a] rounded-lg', 'ops-surface ops-table-wrap'),
    ('border border-[#2a2a2a] rounded-lg divide-y divide-[#2a2a2a]', 'ops-surface'),
    ('bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4', 'ops-stat-cell'),
    ('bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3', 'ops-stat-cell'),
    ('bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg', 'ops-surface'),
    ('bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3', 'ops-log-pre'),
    ('bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3', 'ops-log-pre'),
    ('class="w-full text-sm"', 'class="ops-table w-full text-sm"'),
    ('class="w-full text-sm text-left"', 'class="ops-table w-full text-sm text-left"'),
    ('bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-white', 'ops-input'),
    ('bg-[#22c55e] text-black px-4 py-2 rounded font-medium', 'ops-btn ops-btn-green'),
    ('bg-[#22c55e] text-black px-4 py-2 rounded text-sm font-medium', 'ops-btn ops-btn-green'),
    ('class="text-[#06b6d4] hover:underline', 'class="ops-link'),
    ('class="text-[#22c55e] hover:underline', 'class="ops-link-green'),
]

HEADER_RE = re.compile(
    r'<div class="flex flex-wrap[^"]*mb-6">\s*'
    r'(?:<div>\s*)?'
    r'<h1 class="text-2xl font-bold text-white">([^<]+)</h1>\s*'
    r'(?:<p class="text-sm text-gray-400 mt-1">([^<]+)</p>\s*)?'
    r'</div>\s*',
    re.MULTILINE,
)

HEADER_RE2 = re.compile(
    r'<div class="flex flex-wrap items-center justify-between gap-4 mb-6">\s*'
    r'<h1 class="text-2xl font-bold text-white">([^<]+)</h1>\s*'
    r'</div>\s*',
    re.MULTILINE,
)

SIMPLE_H1 = re.compile(
    r'<h1 class="text-2xl font-bold text-white mb-4">([^<]+)</h1>\s*'
    r'<p class="text-sm text-gray-400 mb-6">([^<]+)</p>',
    re.MULTILINE,
)


def has_ops_page_wrapper(content: str) -> bool:
    return 'class="ops-page"' in content or 'class="ops-chat-page"' in content


def wrap_ops_page(content: str, name: str) -> str:
    if has_ops_page_wrapper(content) or 'ops-chat-page' in content:
        return content
    if name.startswith('partials/'):
        return content
    m = re.match(r'(<% title = [^%]+%>\s*)', content)
    if m:
        rest = content[m.end():]
        return m.group(1) + '<div class="ops-page">\n' + rest.rstrip() + '\n</div>\n'
    return '<div class="ops-page">\n' + content.rstrip() + '\n</div>\n'


def flatten_headers(content: str) -> str:
    def repl1(m: re.Match) -> str:
        title, sub = m.group(1), m.group(2) or ''
        sub_html = f'<div class="ops-page-sub">{sub}</div>' if sub else ''
        return (
            f'<div class="ops-page-head"><div>'
            f'<div class="ops-page-title">{title}</div>{sub_html}'
            f'</div></div>\n'
        )

    content = HEADER_RE.sub(repl1, content)
    content = HEADER_RE2.sub(
        lambda m: f'<div class="ops-page-head"><div><div class="ops-page-title">{m.group(1)}</div></div></div>\n',
        content,
    )
    content = SIMPLE_H1.sub(
        lambda m: (
            f'<div class="ops-page-head"><div>'
            f'<div class="ops-page-title">{m.group(1)}</div>'
            f'<div class="ops-page-sub">{m.group(2)}</div>'
            f'</div></div>\n'
        ),
        content,
    )
    return content


def process_file(path: Path) -> bool:
    rel = path.relative_to(VIEWS).as_posix()
    if rel in SKIP:
        return False
    original = path.read_text(encoding='utf-8')
    content = original
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    content = flatten_headers(content)
    content = wrap_ops_page(content, rel)
    if content != original:
        path.write_text(content, encoding='utf-8')
        return True
    return False


def main() -> None:
    changed = []
    for path in sorted(VIEWS.rglob('*.ejs')):
        if process_file(path):
            changed.append(path.relative_to(ROOT).as_posix())
    print(f'Updated {len(changed)} files')
    for c in changed:
        print(f'  {c}')


if __name__ == '__main__':
    main()
