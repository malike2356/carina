#!/usr/bin/env python3
"""Rewrite .env.docker.runtime for Docker Compose service hostnames and credentials."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / '.env.docker.runtime'

SCOUT_ENV_CANDIDATES = [
    ROOT.parent.parent / 'backends' / 'servers' / 'console.labyrinthscout.com' / '.env',
    ROOT.parent.parent / 'servers' / 'console.labyrinthscout.com' / '.env',
    Path('/home/malike/apps/console.labyrinthscout.com/.env'),
]

SCOUT_PAIRING_KEYS = (
    'LABYRINTH_ENABLED',
    'LABYRINTH_API_KEY',
    'SCOUT_API_KEY',
    'LABYRINTH_INSTANCE_ID',
    'LABYRINTH_INSTANCE_NAME',
)

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


def parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or '=' not in stripped:
            continue
        key, _, value = stripped.partition('=')
        values[key.strip()] = value.strip()
    return values


def scout_pairing_values() -> dict[str, str]:
    merged: dict[str, str] = {}
    for candidate in SCOUT_ENV_CANDIDATES:
        merged.update(parse_env_file(candidate))
    out: dict[str, str] = {}
    if not merged.get('LABYRINTH_ENABLED'):
        out['LABYRINTH_ENABLED'] = 'true'
    api_key = merged.get('LABYRINTH_API_KEY') or merged.get('SCOUT_API_KEY')
    if api_key:
        out['LABYRINTH_API_KEY'] = api_key
    for key in ('LABYRINTH_INSTANCE_ID', 'LABYRINTH_INSTANCE_NAME'):
        value = merged.get(key)
        if value:
            out[key] = value
    return out


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
        if '=' in line:
            seen.add(key)

    for key, value in DOCKER_URLS.items():
        if key not in seen:
            out.append(f'{key}={value}')
            seen.add(key)

    pairing = scout_pairing_values()
    for key in SCOUT_PAIRING_KEYS:
        if key in seen:
            continue
        value = pairing.get(key)
        if value:
            out.append(f'{key}={value}')
            seen.add(key)

    ENV_PATH.write_text('\n'.join(out) + '\n')
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
