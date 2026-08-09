#!/usr/bin/env python3
"""Rewrite cloud .env.runtime for Docker Compose networking.

Always merge missing secrets from app.carinaai.uk/.env so a truncated
.env.cloud.runtime cannot drop BETTER_AUTH_SECRET and break Aiva auth.
"""

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
REQUIRED_KEYS = ('BETTER_AUTH_SECRET', 'DATABASE_URL')


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


def write_env(values: dict[str, str], preferred_order: list[str]) -> None:
    keys = list(dict.fromkeys([*preferred_order, *sorted(values.keys())]))
    lines = [f'{key}={values[key]}' for key in keys if key in values]
    ENV_PATH.write_text('\n'.join(lines) + '\n')


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not ENV_PATH.exists() and src is not None:
        ENV_PATH.write_text(src.read_text())
    if not ENV_PATH.exists():
        raise SystemExit(
            f'missing {ENV_PATH}; copy from app.carinaai.uk/.env first')

    current = parse_env_file(ENV_PATH)
    source = parse_env_file(src) if src is not None else {}
    preferred_order = list(current.keys())

    # Fill any missing secret/config keys from the app .env (never blank auth).
    for key, value in source.items():
        if not value:
            continue
        if key not in current or not current.get(key, '').strip():
            current[key] = value
            if key not in preferred_order:
                preferred_order.append(key)

    for key, value in DOCKER_DEFAULTS.items():
        current[key] = value
        if key not in preferred_order:
            preferred_order.append(key)

    for key, value in core_pairing_values().items():
        current[key] = value
        if key not in preferred_order:
            preferred_order.append(key)

    missing = [key for key in REQUIRED_KEYS if not current.get(key, '').strip()]
    if missing:
        raise SystemExit(
            f'{ENV_PATH.name} is missing required keys after sync: {", ".join(missing)}. '
            'Restore from /home/malike/apps/app.carinaai.uk/.env before deploying carina-cloud.'
        )

    write_env(current, preferred_order)
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
