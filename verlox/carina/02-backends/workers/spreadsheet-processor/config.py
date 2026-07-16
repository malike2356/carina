"""Configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

IMAP_HOST = os.environ['IMAP_HOST']
IMAP_PORT = int(os.environ.get('IMAP_PORT', '993'))
IMAP_USER = os.environ['IMAP_USER']
IMAP_PASSWORD = os.environ['IMAP_PASSWORD']

SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.resend.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', 'resend')
SMTP_PASSWORD = os.environ['SMTP_PASSWORD']
SMTP_FROM = os.environ.get('SMTP_FROM', 'contact@verlox.uk')

DEEPSEEK_API_KEY = os.environ['DEEPSEEK_API_KEY']

POLL_INTERVAL = int(os.environ.get('POLL_INTERVAL', '120'))

STATE_FILE = os.path.expanduser(
    os.environ.get('STATE_FILE', '~/.hermes/data/spreadsheet-processor-state.json')
)
