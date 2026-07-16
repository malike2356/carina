#!/usr/bin/env python3
"""Send the enriched spreadsheet back to the sender via Resend SMTP."""
import os
import smtplib
import ssl
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import config as cfg


def reply_with_enriched(
    to: str,
    subject: str,
    enriched_path: str,
    summary: str,
) -> None:
    msg = MIMEMultipart()
    msg['From'] = cfg.SMTP_FROM
    msg['To'] = to
    msg['Subject'] = f'Re: {subject}'

    body = (
        'Your spreadsheet has been processed and enriched.\n\n'
        f'{summary}\n\n'
        'See the attached file. Reply to this email if you need '
        'anything adjusted.\n\n'
        'Aiva (your AI assistant)\n'
        'VERLOX'
    )
    msg.attach(MIMEText(body, 'plain'))

    filename = os.path.basename(enriched_path)
    with open(enriched_path, 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
        msg.attach(part)

    ctx = ssl.create_default_context()
    with smtplib.SMTP(cfg.SMTP_HOST, cfg.SMTP_PORT) as server:
        server.starttls(context=ctx)
        server.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
        server.sendmail(cfg.SMTP_FROM, to, msg.as_string())
