#!/usr/bin/env python3
"""SPSS .sav and .spv file I/O for Carina research tools."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

try:
    import pyreadstat
except ImportError:  # pragma: no cover - exercised when dependency missing
    pyreadstat = None


def _require_pyreadstat() -> Any:
    if pyreadstat is None:
        raise RuntimeError(
            "pyreadstat is not installed. Run: pip install pyreadstat pandas"
        )
    return pyreadstat


def _measure_name(value: Any) -> str:
    measure_map = {
        'nominal': 'nominal',
        'ordinal': 'ordinal',
        'scale': 'scale',
        'unknown': 'unknown',
    }
    if value is None:
        return 'unknown'
    return measure_map.get(str(value).lower(), str(value))


def read_sav(filepath: str, include_data: bool = True, max_rows: int | None = None) -> dict[str, Any]:
    """Read a .sav file and return metadata plus optional data rows."""
    lib = _require_pyreadstat()
    try:
        df, meta = lib.read_sav(filepath)
        column_labels = getattr(meta, 'column_names_to_labels', {}) or {}
        value_labels = getattr(meta, 'variable_value_labels', {}) or {}
        variable_measure = getattr(meta, 'variable_measure', {}) or {}

        result: dict[str, Any] = {
            'file': filepath,
            'rows': int(getattr(meta, 'number_rows', len(df)) or len(df)),
            'columns': int(getattr(meta, 'number_columns', len(df.columns)) or len(df.columns)),
            'file_label': getattr(meta, 'file_label', None),
            'variables': [],
        }

        for col in df.columns:
            col_name = str(col)
            var_info: dict[str, Any] = {
                'name': col_name,
                'type': str(df[col].dtype),
                'label': column_labels.get(col_name, '') or '',
                'missing_count': int(df[col].isna().sum()),
            }

            if col_name in value_labels and value_labels[col_name]:
                var_info['value_labels'] = {
                    str(key): value for key, value in value_labels[col_name].items()
                }

            if col_name in variable_measure:
                var_info['measure'] = _measure_name(variable_measure[col_name])

            result['variables'].append(var_info)

        if include_data:
            preview = df.head(max_rows) if max_rows else df
            result['data'] = preview.to_dict(orient='records')
            result['data_row_count'] = len(preview)
            result['data_truncated'] = bool(max_rows and len(df) > max_rows)

        return result
    except Exception as exc:  # noqa: BLE001 - return structured tool error
        return {'error': str(exc), 'file': filepath}


def write_sav(filepath: str, data: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Write records to a .sav file with optional labels."""
    lib = _require_pyreadstat()
    try:
        import pandas as pd

        frame = pd.DataFrame(data)
        column_labels: dict[str, str] = {}
        value_labels: dict[str, dict[int, str]] = {}
        variable_measure: dict[str, str] = {}

        if metadata:
            for var in metadata.get('variables', []):
                name = var.get('name')
                if not name:
                    continue
                if var.get('label'):
                    column_labels[name] = var['label']
                if var.get('value_labels'):
                    value_labels[name] = {
                        int(key): value for key, value in var['value_labels'].items()
                    }
                if var.get('measure'):
                    variable_measure[name] = _measure_name(var['measure'])

        lib.write_sav(
            frame,
            filepath,
            column_labels=column_labels or None,
            variable_value_labels=value_labels or None,
            variable_measure=variable_measure or None,
        )

        return {
            'success': True,
            'file': filepath,
            'rows': len(frame),
            'columns': len(frame.columns),
        }
    except Exception as exc:  # noqa: BLE001
        return {'error': str(exc), 'file': filepath}


def _local_name(tag: str) -> str:
    if '}' in tag:
        return tag.rsplit('}', 1)[-1]
    return tag


def _extract_spv_text(element: ET.Element) -> list[str]:
    chunks: list[str] = []
    text = (element.text or '').strip()
    if text:
        chunks.append(text)
    for child in element:
        chunks.extend(_extract_spv_text(child))
        tail = (child.tail or '').strip()
        if tail:
            chunks.append(tail)
    return chunks


def read_spv(filepath: str) -> dict[str, Any]:
    """Read SPSS viewer output (.spv) by parsing the ZIP/XML structure."""
    try:
        result: dict[str, Any] = {
            'file': filepath,
            'tables': [],
            'text': [],
        }

        with zipfile.ZipFile(filepath, 'r') as archive:
            xml_names = sorted(
                name for name in archive.namelist()
                if name.endswith('.xml') and 'outputViewer' in name
            )

            for name in xml_names:
                raw = archive.read(name)
                try:
                    root = ET.fromstring(raw)
                except ET.ParseError:
                    continue

                title = ''
                if name.endswith('_heading.xml'):
                    heading_text = ' '.join(_extract_spv_text(root)).strip()
                    if heading_text:
                        title = heading_text
                        result['text'].append(heading_text)
                    continue

                body_text = ' '.join(_extract_spv_text(root)).strip()
                if not body_text:
                    continue

                if any(token in body_text.lower() for token in ('table', 'row', 'column', 'statistic')):
                    rows = [
                        [part.strip() for part in line.split() if part.strip()]
                        for line in body_text.splitlines()
                        if line.strip()
                    ]
                    if rows:
                        result['tables'].append({
                            'title': title or Path(name).stem,
                            'source': name,
                            'rows': rows,
                        })
                        continue

                result['text'].append(body_text)

        if not result['tables'] and not result['text']:
            return {
                'error': 'No readable tables or text found in .spv archive',
                'file': filepath,
            }

        return result
    except zipfile.BadZipFile:
        return {'error': 'File is not a valid .spv ZIP archive', 'file': filepath}
    except Exception as exc:  # noqa: BLE001
        return {'error': str(exc), 'file': filepath}


def check_dependencies() -> dict[str, Any]:
    available = pyreadstat is not None
    pandas_available = False
    if available:
        try:
            import pandas  # noqa: F401

            pandas_available = True
        except ImportError:
            available = False
    return {
        'pyreadstat': available,
        'pandas': pandas_available,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='SPSS file I/O')
    sub = parser.add_subparsers(dest='command', required=True)

    deps_cmd = sub.add_parser('deps')

    read_cmd = sub.add_parser('read')
    read_cmd.add_argument('--file', required=True)
    read_cmd.add_argument('--max-rows', type=int)
    read_cmd.add_argument('--metadata-only', action='store_true')

    write_cmd = sub.add_parser('write')
    write_cmd.add_argument('--file', required=True)
    write_cmd.add_argument('--data', required=True)
    write_cmd.add_argument('--metadata')

    spv_cmd = sub.add_parser('spv')
    spv_cmd.add_argument('--file', required=True)

    args = parser.parse_args()

    if args.command == 'deps':
        print(json.dumps(check_dependencies(), indent=2))
        return 0

    if args.command == 'read':
        result = read_sav(
            args.file,
            include_data=not args.metadata_only,
            max_rows=args.max_rows,
        )
        print(json.dumps(result, indent=2, default=str))
        return 0 if 'error' not in result else 1

    if args.command == 'write':
        data = json.loads(args.data)
        metadata = json.loads(args.metadata) if args.metadata else None
        result = write_sav(args.file, data, metadata)
        print(json.dumps(result, indent=2))
        return 0 if result.get('success') else 1

    if args.command == 'spv':
        result = read_spv(args.file)
        print(json.dumps(result, indent=2, default=str))
        return 0 if 'error' not in result else 1

    return 1


if __name__ == '__main__':
    raise SystemExit(main())
