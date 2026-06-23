#!/usr/bin/env python3
"""Rewrite ops .env.runtime for Docker Compose networking."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / '.env.ops.runtime'
SRC_CANDIDATES = [
    ROOT.parent.parent / 'backends' / 'admin' / 'ops.carinaai.uk' / '.env',
    ROOT.parent.parent / 'admin' / 'ops.carinaai.uk' / '.env',
    Path('/home/malike/apps/ops.carinaai.uk/.env'),
]

SCOUT_ENV_CANDIDATES = [
    ROOT.parent.parent / 'backends' / 'servers' / 'console.labyrinthscout.com' / '.env',
    ROOT.parent.parent / 'servers' / 'console.labyrinthscout.com' / '.env',
    Path('/home/malike/apps/console.labyrinthscout.com/.env'),
]

OPERATOR_KEYS = ('SCOUT_OPERATOR_ACCOUNT_ID', 'SCOUT_OPERATOR_INSTANCE_ID')

SCOUT_PAIRING_KEYS = ('SCOUT_API_KEY',)

# Terminal bridge JWT must use the same secret in carina-cloud and carina-ops.
BRIDGE_SECRET_KEYS = (
    'CARINA_TERMINAL_BRIDGE_SECRET',
    'CARINA_INTERNAL_KEY',
    'CARINA_OPS_TOKEN',
)

CLOUD_RUNTIME_CANDIDATES = [
    ROOT / '.env.cloud.runtime',
    Path('/home/malike/apps/core.carinaai.uk/.env.cloud.runtime'),
]

DB_USER = os.environ.get('DB_USER', 'carina')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'secret')
DB_HOST = os.environ.get('DB_HOST', 'postgres')
DB_PORT = os.environ.get('DB_PORT', '5432')

DOCKER_DEFAULTS = {
    'PORT': '4001',
    'CARINA_API_URL': 'http://carina-web:3000',
    'CARINA_DB_URL': f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/carina',
    'SCOUT_CONSOLE_URL': 'http://scout-console:4444',
    'SCOUT_URL': 'http://scout-console:4444',
    'SCOUT_ADMIN_API_URL': 'http://scout-engine:4455',
    'SCOUT_ENGINE_URL': 'http://scout-engine:4455',
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


def cloud_bridge_secret_values() -> dict[str, str]:
    for candidate in CLOUD_RUNTIME_CANDIDATES:
        values = parse_env_file(candidate)
        if any(values.get(key) for key in BRIDGE_SECRET_KEYS):
            return values
    return {}


def upsert_env_line(lines: list[str], key: str, value: str) -> list[str]:
    replaced = False
    out: list[str] = []
    for line in lines:
        if line.startswith(f'{key}='):
            out.append(f'{key}={value}')
            replaced = True
            continue
        out.append(line)
    if not replaced:
        out.append(f'{key}={value}')
    return out


def scout_operator_values() -> dict[str, str]:
    merged: dict[str, str] = {}
    for candidate in SCOUT_ENV_CANDIDATES:
        merged.update(parse_env_file(candidate))
        if merged.get('SCOUT_OPERATOR_ACCOUNT_ID'):
            break
    return merged


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not ENV_PATH.exists() and src is not None:
        ENV_PATH.write_text(src.read_text())
    if not ENV_PATH.exists():
        raise SystemExit(f'missing {ENV_PATH}; copy from ops.carinaai.uk/.env first')

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
        if '=' in line:
            seen.add(key)
    for key, value in DOCKER_DEFAULTS.items():
        if key not in seen:
            out.append(f'{key}={value}')
    scout_vars = scout_operator_values()
    for key in (*OPERATOR_KEYS, *SCOUT_PAIRING_KEYS):
        value = scout_vars.get(key)
        if not value or value == 'undefined':
            continue
        out = upsert_env_line(out, key, value)
        seen.add(key)
    cloud_vars = cloud_bridge_secret_values()
    for key in BRIDGE_SECRET_KEYS:
        cloud_value = cloud_vars.get(key)
        if not cloud_value:
            continue
        current = next((line.split('=', 1)[1] for line in out if line.startswith(f'{key}=')), '')
        if not current:
            out = upsert_env_line(out, key, cloud_value)
            seen.add(key)
    ENV_PATH.write_text('\n'.join(out) + '\n')
    print(f'updated {ENV_PATH.name} for docker networking')


if __name__ == '__main__':
    main()
