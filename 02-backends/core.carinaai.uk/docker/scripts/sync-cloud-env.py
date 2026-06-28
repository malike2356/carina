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
PGBOUNCER_ENABLED = os.environ.get('PGBOUNCER_ENABLED', '1')
DB_HOST = os.environ.get('DB_HOST', 'pgbouncer' if PGBOUNCER_ENABLED == '1' else 'postgres')
DB_PORT = os.environ.get('DB_PORT', '6432' if PGBOUNCER_ENABLED == '1' else '5432')

DOCKER_DEFAULTS = {
    'PORT': '4100',
    'HOSTNAME': '0.0.0.0',
    'CARINA_CORE_URL': 'http://carina-web:3000',
    'CARINA_USE_CORE_PROXY': 'true',
    'SKILLS_HUB_INTERNAL_URL': 'http://carina-hub:3001',
    'DATABASE_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina_cloud',
}

CORE_PAIRING_KEYS = ('CARINA_OPS_TOKEN', 'CARINA_INTERNAL_KEY')


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


def core_pairing_values() -> dict[str, str]:
    """Share ops/internal secrets from core docker env into cloud runtime."""
    docker = parse_env_file(ROOT / '.env.docker.runtime')
    out: dict[str, str] = {}
    for key in CORE_PAIRING_KEYS:
        value = docker.get(key, '').strip()
        if value:
            out[key] = value
    return out


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not ENV_PATH.exists() and src is not None:
        ENV_PATH.write_text(src.read_text())
    if not ENV_PATH.exists():
        raise SystemExit(
            f'missing {ENV_PATH}; copy from app.carinaai.uk/.env first')

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
    for key, value in core_pairing_values().items():
        out = [line for line in out if not line.startswith(f'{key}=')]
        out.append(f'{key}={value}')
    ENV_PATH.write_text('\n'.join(out) + '\n')
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
