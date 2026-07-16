#!/usr/bin/env python3
"""
IMAP inbox watcher.
Polls for unread emails with spreadsheet attachments, hands them to the
processor, and replies with the enriched file.
"""
import imaplib
import email
import json
import os
import re
import sys
import tempfile
import time
from email.header import decode_header

import config as cfg
from processor import process_spreadsheet
from mailer import reply_with_enriched


def _load_state() -> dict:
    if os.path.exists(cfg.STATE_FILE):
        with open(cfg.STATE_FILE) as f:
            return json.load(f)
    return {'last_uid': 0, 'processed': []}


def _save_state(state: dict) -> None:
    os.makedirs(os.path.dirname(cfg.STATE_FILE), exist_ok=True)
    with open(cfg.STATE_FILE, 'w') as f:
        json.dump(state, f)


SPREADSHEET_EXTS = ('.xlsx', '.xls', '.csv', '.ods')


def _decode_subject(raw_subject) -> str:
    if raw_subject is None:
        return '(no subject)'
    decoded, enc = decode_header(raw_subject)[0]
    if isinstance(decoded, bytes):
        return decoded.decode(enc or 'utf-8', errors='replace')
    return str(decoded)


def _extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                try:
                    return part.get_payload(decode=True).decode('utf-8', errors='ignore')
                except Exception:
                    pass
    else:
        try:
            return msg.get_payload(decode=True).decode('utf-8', errors='ignore')
        except Exception:
            pass
    return ''


def _extract_sender_email(from_header: str) -> str:
    match = re.search(r'[\w.\-+]+@[\w.\-]+', from_header or '')
    return match.group(0) if match else from_header


def _extract_attachments(msg: email.message.Message) -> list[str]:
    """Save spreadsheet attachments to temp files; return paths."""
    paths = []
    for part in msg.walk():
        filename = part.get_filename()
        if filename and any(filename.lower().endswith(ext) for ext in SPREADSHEET_EXTS):
            data = part.get_payload(decode=True)
            tmp = os.path.join(tempfile.gettempdir(), f'aiva-{filename}')
            with open(tmp, 'wb') as f:
                f.write(data)
            paths.append(tmp)
    return paths


def _poll_once(imap: imaplib.IMAP4_SSL, state: dict) -> None:
    imap.select('INBOX')
    _, msgs = imap.uid('search', None, 'UNSEEN')
    uids = msgs[0].split() if msgs[0] else []

    for uid_bytes in uids:
        uid = int(uid_bytes)
        if uid <= state['last_uid'] or uid in state.get('processed', []):
            continue

        _, data = imap.uid('fetch', uid_bytes, '(RFC822)')
        msg = email.message_from_bytes(data[0][1])

        attachments = _extract_attachments(msg)
        if not attachments:
            state['last_uid'] = max(state['last_uid'], uid)
            continue

        sender = _extract_sender_email(msg.get('From', ''))
        subject = _decode_subject(msg.get('Subject'))
        body = _extract_body(msg).strip()[:500]

        print(f'[monitor] {len(attachments)} file(s) from {sender}: {subject}',
              file=sys.stderr)

        for filepath in attachments:
            result = process_spreadsheet(filepath, sender, subject, body)
            if result:
                reply_with_enriched(
                    to=sender,
                    subject=subject,
                    enriched_path=result['path'],
                    summary=result['summary'],
                )
                print(f'[monitor] replied to {sender} with {os.path.basename(result["path"])}',
                      file=sys.stderr)

        state['processed'] = (state.get('processed', []) + [uid])[-200:]
        state['last_uid'] = max(state['last_uid'], uid)

    _save_state(state)


def run() -> None:
    state = _load_state()
    print(f'[monitor] watching {cfg.IMAP_USER} every {cfg.POLL_INTERVAL}s',
          file=sys.stderr)

    while True:
        try:
            imap = imaplib.IMAP4_SSL(cfg.IMAP_HOST, cfg.IMAP_PORT)
            imap.login(cfg.IMAP_USER, cfg.IMAP_PASSWORD)
            _poll_once(imap, state)
            imap.logout()
        except Exception as exc:
            print(f'[monitor] error: {exc}', file=sys.stderr)

        time.sleep(cfg.POLL_INTERVAL)


if __name__ == '__main__':
    run()
