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

import pandas as pd

import config as cfg

PROMPTS = {
    'generic': (
        'You enrich tabular business data. Return JSON only as '
        '{"rows":{"0":{"Column":"value"}}}. Use zero-based row indexes. '
        'Fill only blank cells. Do not invent personal data, sensitive traits, '
        'or facts without evidence. Omit uncertain fills.'
    ),
    'leads': (
        'You enrich a lead list from supplied evidence. Return JSON only as '
        '{"rows":{"0":{"Column":"value"}}}. Fill only blank cells. Never '
        'guess email addresses or phone numbers. Do not infer sensitive traits. '
        'Prefer company, role, stage, and scoring fields supported by the row.'
    ),
    'tenant_list': (
        'You clean a tenant or lease table. Return JSON only as '
        '{"rows":{"0":{"Column":"value"}}}. Fill only blank cells using '
        'facts already present. Do not infer protected, financial, or health data.'
    ),
    'property_data': (
        'You enrich property rows using supplied evidence. Return JSON only as '
        '{"rows":{"0":{"Column":"value"}}}. Fill only blank cells. Do not '
        'invent valuations, addresses, ownership, or contact details.'
    ),
}


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
    return PROMPTS.get(sheet_type, PROMPTS['generic'])


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
    """Send bounded batches to DeepSeek and combine proposed fills."""
    system_prompt = _load_prompt(sheet_type)
    blank_cols = _blank_report(df)

    if not blank_cols and sheet_type == 'generic':
        return {'rows': {}}

    combined = {'rows': {}}
    batch_size = 20
    max_rows = int(os.environ.get('MAX_ENRICH_ROWS', '500'))
    for start in range(0, min(len(df), max_rows), batch_size):
        batch = df.iloc[start:start + batch_size]
        records = batch.where(batch.notna(), None).to_dict(orient='records')
        user_msg = (
            f'Context: {context[:1000]}\n\n'
            f'Columns: {list(df.columns)}\n'
            f'Row count: {len(df)}\n'
            f'Blank columns: {json.dumps(blank_cols)}\n'
            f'Row offset: {start}\n\n'
            f'Data as JSON:\n{json.dumps(records, default=str)[:12000]}'
        )
        result = _call_deepseek(system_prompt, user_msg)
        for relative_idx, values in result.get('rows', {}).items():
            try:
                absolute_idx = start + int(relative_idx)
            except (TypeError, ValueError):
                continue
            combined['rows'][str(absolute_idx)] = values
    return combined


def _apply_fills(df: pd.DataFrame, fills: dict) -> tuple[pd.DataFrame, int]:
    """Apply AI fills; only write into cells that are currently empty."""
    df = df.copy()
    filled = 0
    rows = fills.get('rows', {})

    for row_idx_str, col_vals in rows.items():
        try:
            idx = int(row_idx_str)
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= len(df):
            continue
        if not isinstance(col_vals, dict):
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
