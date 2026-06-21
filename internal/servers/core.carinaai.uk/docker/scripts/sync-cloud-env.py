#!/usr/bin/env python3
"""Rewrite cloud .env.runtime for Docker Compose networking."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / '.env.cloud.runtime'
SRC_CANDIDATES = [
    ROOT.parent.parent / 'external' / 'client-apps' / 'app.carinaai.uk' / '.env',
    Path('/home/malike/apps/app.carinaai.uk/.env'),
]

DB_USER = os.environ.get('DB_USER', 'carina')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'secret')
DB_HOST = os.environ.get('DB_HOST', 'postgres')
DB_PORT = os.environ.get('DB_PORT', '5432')

DOCKER_DEFAULTS = {
    'PORT': '4100',
    'HOSTNAME': '0.0.0.0',
    'CARINA_CORE_URL': 'http://carina-web:3000',
    'CARINA_USE_CORE_PROXY': 'true',
    'SKILLS_HUB_INTERNAL_URL': 'http://carina-hub:3001',
    'DATABASE_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina_cloud',
}


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not ENV_PATH.exists() and src is not None:
        ENV_PATH.write_text(src.read_text())
    if not ENV_PATH.exists():
        raise SystemExit(f'missing {ENV_PATH}; copy from app.carinaai.uk/.env first')

    lines = ENV_PATH.read_text().splitlines()
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = line.split('=', 1)[0] if '=' in line else line
        if key in DOCKER_DEFAULTS:
            out.append(f'{key}={DOCKER_DEFAULTS[key]}')
            seen.add(key)
            continue
        out.append(line)
    for key, value in DOCKER_DEFAULTS.items():
        if key not in seen:
            out.append(f'{key}={value}')
    ENV_PATH.write_text('\n'.join(out) + '\n')
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
