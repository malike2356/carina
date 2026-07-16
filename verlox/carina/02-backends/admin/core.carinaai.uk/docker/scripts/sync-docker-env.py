#!/usr/bin/env python3
"""Rewrite .env.docker.runtime for Docker Compose service hostnames and credentials."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / '.env.docker.runtime'

DB_USER = os.environ.get('DB_USER', 'carina')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'secret')
DB_HOST = os.environ.get('DB_HOST', 'postgres')
DB_PORT = os.environ.get('DB_PORT', '5432')
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')

DOCKER_URLS = {
    'DATABASE_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina',
    'SKILLS_HUB_DATABASE_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina_skills_hub',
    'REDIS_URL': REDIS_URL,
    'LABYRINTH_URL': 'http://labyrinth-scout:4444',
    'LABYRINTH_LLM_ROUTER_URL': 'http://carina-web:3000',
}


def main() -> None:
    if not ENV_PATH.exists():
        raise SystemExit(f'missing {ENV_PATH}; copy from .env first')

    lines = ENV_PATH.read_text().splitlines()
    out: list[str] = []
    seen: set[str] = set()

    for line in lines:
        key = line.split('=', 1)[0] if '=' in line else line
        if key in DOCKER_URLS:
            out.append(f'{key}={DOCKER_URLS[key]}')
            seen.add(key)
            continue
        out.append(line)

    for key, value in DOCKER_URLS.items():
        if key not in seen:
            out.append(f'{key}={value}')

    ENV_PATH.write_text('\n'.join(out) + '\n')
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
