#!/usr/bin/env python3
"""Rewrite staging .env.runtime files to use pgbouncer-staging:6432."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DB_USER = os.environ.get('DB_USER', 'carina')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'staging_secret')
PGBOUNCER_ENABLED = os.environ.get('PGBOUNCER_ENABLED', '1')
DB_HOST = os.environ.get('DB_HOST', 'pgbouncer-staging' if PGBOUNCER_ENABLED == '1' else 'postgres-staging')
DB_PORT = os.environ.get('DB_PORT', '6432' if PGBOUNCER_ENABLED == '1' else '5432')

STAGING_URLS = {
    'DATABASE_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina_staging',
}

STAGING_ADMIN_DEFAULTS = {
    'ADMIN_CORE_URL': 'http://carina-staging-web:3000',
    'PORT': '4200',
    'HOSTNAME': '0.0.0.0',
}


def rewrite_env(path: Path, overrides: dict[str, str]) -> None:
    if not path.exists():
        return
    lines = path.read_text().splitlines()
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = line.split('=', 1)[0] if '=' in line else line
        if key in overrides:
            out.append(f'{key}={overrides[key]}')
            seen.add(key)
            continue
        out.append(line)
        if '=' in line:
            seen.add(key)
    for key, value in overrides.items():
        if key not in seen:
            out.append(f'{key}={value}')
    path.write_text('\n'.join(out) + '\n')
    print(f'updated {path.name} for staging networking')


def main() -> None:
    rewrite_env(ROOT / '.env.staging.runtime', STAGING_URLS)
    rewrite_env(ROOT / '.env.staging.cloud.runtime', STAGING_URLS)
    rewrite_env(ROOT / '.env.staging.admin.runtime', STAGING_ADMIN_DEFAULTS)


if __name__ == '__main__':
    main()
