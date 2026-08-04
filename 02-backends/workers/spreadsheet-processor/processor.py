#!/usr/bin/env python3
"""
Spreadsheet enrichment pipeline.
Reads an Excel/CSV, classifies the sheet type, enriches rows via DeepSeek,
and writes an enriched copy.
"""
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path

import pandas as pd

import config as cfg

PROMPTS_DIR = Path(__file__).parent / 'prompts'


def _classify_sheet(df: pd.DataFrame) -> str:
    """Auto-detect spreadsheet category from column names."""
    cols = ' '.join(c.lower() for c in df.columns)

    if any(w in cols for w in ('tenant', 'lease', 'rent', 'landlord')):
        return 'tenant_list'
    if any(w in cols for w in ('lead', 'contact', 'enquiry', 'source')):
        return 'leads'
    if any(w in cols for w in ('property', 'address', 'bedroom', 'valuation', 'postcode')):
        return 'property_data'
    return 'generic'


def _load_prompt(sheet_type: str) -> str:
    path = PROMPTS_DIR / f'enrich_{sheet_type}.txt'
    if not path.exists():
        path = PROMPTS_DIR / 'enrich_generic.txt'
    return path.read_text()


def _blank_report(df: pd.DataFrame) -> dict[str, int]:
    blanks = df.isnull().sum().to_dict()
    return {k: int(v) for k, v in blanks.items() if v > 0}


def _call_deepseek(system_prompt: str, user_content: str) -> dict:
    payload = json.dumps({
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_content},
        ],
        'temperature': 0.3,
        'max_tokens': 4000,
    }).encode()

    req = urllib.request.Request(
        'https://api.deepseek.com/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {cfg.DEEPSEEK_API_KEY}',
            'Content-Type': 'application/json',
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        body = json.loads(resp.read())
        content = body['choices'][0]['message']['content']
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as exc:
        print(f'[processor] DeepSeek error: {exc}', file=sys.stderr)

    return {'rows': {}}


def _enrich_batch(df: pd.DataFrame, sheet_type: str, context: str) -> dict:
    """Send the full sheet context to DeepSeek and get fills for all rows."""
    system_prompt = _load_prompt(sheet_type)
    blank_cols = _blank_report(df)

    if not blank_cols and sheet_type == 'generic':
        return {'rows': {}}

    sample = df.head(20).to_string()

    user_msg = (
        f'Context: {context}\n\n'
        f'Columns: {list(df.columns)}\n'
        f'Row count: {len(df)}\n'
        f'Blank columns: {json.dumps(blank_cols)}\n\n'
        f'Data (first 20 rows):\n{sample[:3000]}'
    )

    return _call_deepseek(system_prompt, user_msg)


def _apply_fills(df: pd.DataFrame, fills: dict) -> tuple[pd.DataFrame, int]:
    """Apply AI fills; only write into cells that are currently empty."""
    df = df.copy()
    filled = 0
    rows = fills.get('rows', {})

    for row_idx_str, col_vals in rows.items():
        try:
            idx = int(row_idx_str)
        except ValueError:
            continue
        if idx < 0 or idx >= len(df):
            continue
        for col, value in col_vals.items():
            if col in df.columns and pd.isna(df.iloc[idx][col]):
                df.at[idx, col] = value
                filled += 1

    return df, filled


def process_spreadsheet(
    filepath: str,
    sender: str,
    subject: str,
    body: str,
) -> dict | None:
    """
    Main entry point. Returns {'path': ..., 'summary': ...} or None on error.
    """
    try:
        if filepath.lower().endswith('.csv'):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)

        sheet_type = _classify_sheet(df)
        blank_cols = _blank_report(df)
        total_blanks = sum(blank_cols.values()) if blank_cols else 0

        print(f'[processor] {os.path.basename(filepath)}: '
              f'type={sheet_type}, rows={len(df)}, blanks={total_blanks}',
              file=sys.stderr)

        context = f'Sender: {sender}, Subject: {subject}'
        if body:
            context += f', Instructions: {body[:300]}'

        fills = _enrich_batch(df, sheet_type, context)
        enriched_df, filled_count = _apply_fills(df, fills)

        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        base = os.path.splitext(os.path.basename(filepath))[0]
        out_path = os.path.join(tempfile.gettempdir(), f'{base}-enriched-{ts}.xlsx')
        enriched_df.to_excel(out_path, index=False)

        summary = (
            f'Sheet type: {sheet_type}\n'
            f'Rows: {len(df)}\n'
            f'Blank cells found: {total_blanks}\n'
            f'Cells filled: {filled_count}\n'
            f'Blank columns: {", ".join(blank_cols.keys()) if blank_cols else "none"}'
        )

        return {'path': out_path, 'summary': summary}

    except Exception as exc:
        print(f'[processor] error processing {filepath}: {exc}', file=sys.stderr)
        return None
