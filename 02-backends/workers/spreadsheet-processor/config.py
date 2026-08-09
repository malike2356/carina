"""Configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

def _env(name: str, default: str | None = None) -> str:
    """Accept worker-native names and Ops-panel SP_ aliases."""
    value = os.environ.get(name, os.environ.get(f'SP_{name}', default))
    if value is None or not value.strip():
        raise RuntimeError(f'Missing required environment variable: {name} (or SP_{name})')
    return value.strip()


IMAP_HOST = _env('IMAP_HOST')
IMAP_PORT = int(_env('IMAP_PORT', '993'))
IMAP_USER = _env('IMAP_USER')
IMAP_PASSWORD = _env('IMAP_PASSWORD')

SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.resend.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', 'resend')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', os.environ.get('RESEND_API_KEY', '')).strip()
if not SMTP_PASSWORD:
    raise RuntimeError('Missing required environment variable: SMTP_PASSWORD (or RESEND_API_KEY)')
SMTP_FROM = os.environ.get('SMTP_FROM', 'contact@verlox.uk')

DEEPSEEK_API_KEY = _env('DEEPSEEK_API_KEY')

POLL_INTERVAL = int(_env('POLL_INTERVAL', '120'))

STATE_FILE = os.path.expanduser(
    os.environ.get('STATE_FILE', '~/.hermes/data/spreadsheet-processor-state.json')
)
