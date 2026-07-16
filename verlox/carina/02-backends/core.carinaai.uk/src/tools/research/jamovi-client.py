#!/usr/bin/env python3
"""Jamovi connectivity client and jmv-backed analysis runner for Carina."""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_JAMOVI_URL = 'http://127.0.0.1:41337'
SCRIPT_DIR = Path(__file__).resolve().parent
ANALYZE_R = SCRIPT_DIR / 'jamovi-analyze.R'

ANALYSIS_MAP = {
    'descriptive': 'descriptive',
    'ttest_independent': 'ttest_independent',
    'ttest_paired': 'ttest_paired',
    'ttest_one_sample': 'ttest_one_sample',
    'anova': 'anova',
    'anova_repeated': 'anova_repeated',
    'ancova': 'ancova',
    'chi_square': 'chi_square',
    'correlation': 'correlation',
    'regression_linear': 'regression_linear',
    'regression_logistic': 'regression_logistic',
    'nonparametric_mann_whitney': 'ttest_independent',
    'nonparametric_wilcoxon': 'ttest_paired',
    'nonparametric_kruskal_wallis': 'anova',
    'factor': 'factor',
    'reliability': 'reliability',
}


def jamovi_config_dir() -> Path:
    if sys.platform == 'linux':
        return Path.home() / '.jamovi'
    return Path.home() / '.config' / 'jamovi'


def discover_jamovi_url(override: str | None = None) -> str | None:
    if override:
        return override.rstrip('/')

    port_files = sorted(glob.glob(str(jamovi_config_dir() / '*.port')))
    if not port_files:
        return None

    match = re.search(r'(\d+)\.port$', os.path.basename(port_files[0]))
    if not match:
        return None

    return f'http://127.0.0.1:{match.group(1)}'


def http_get_json(url: str, timeout: float = 5.0) -> Any:
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode('utf-8')
        if not body.strip():
            return []
        return json.loads(body)


def check_jamovi(url: str | None = None) -> dict[str, Any]:
    base_url = discover_jamovi_url(url)
    if not base_url:
        return {
            'running': False,
            'url': None,
            'datasetCount': 0,
            'jmvAvailable': check_jmv_available(),
        }

    try:
        datasets = http_get_json(f'{base_url}/api/datasets', timeout=5.0)
        count = len(datasets) if isinstance(datasets, list) else 0
        return {
            'running': True,
            'url': base_url,
            'datasetCount': count,
            'jmvAvailable': check_jmv_available(),
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return {
            'running': False,
            'url': base_url,
            'datasetCount': 0,
            'jmvAvailable': check_jmv_available(),
        }


def list_datasets(url: str | None = None) -> dict[str, Any]:
    base_url = discover_jamovi_url(url)
    if not base_url:
        return {'error': 'Jamovi is not running (no .port file found)'}

    try:
        datasets = http_get_json(f'{base_url}/api/datasets', timeout=5.0)
        if not isinstance(datasets, list):
            return {'error': 'Unexpected Jamovi datasets response'}
        return {'url': base_url, 'datasets': datasets}
    except (urllib.error.URLError, TimeoutError) as exc:
        return {'error': str(exc)}
    except (json.JSONDecodeError, ValueError) as exc:
        return {'error': f'Invalid Jamovi response: {exc}'}


def check_jmv_available() -> bool:
    try:
        completed = subprocess.run(
            ['Rscript', '-e', 'cat(requireNamespace("jmv", quietly=TRUE))'],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return completed.stdout.strip() == 'TRUE'
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def run_analysis(
    data_path: str,
    analysis_type: str,
    variables: list[str],
    *,
    group_by: str | None = None,
    dependent: str | None = None,
    covariates: list[str] | None = None,
    options: dict[str, Any] | None = None,
    jamovi_url: str | None = None,
) -> dict[str, Any]:
    data_file = Path(data_path).expanduser().resolve()
    if not data_file.exists():
        return {'error': f'Data file not found: {data_file}'}

    if not check_jmv_available():
        return {
            'error': (
                "R package 'jmv' is not available. Install R, then run: "
                "install.packages(c('jmv', 'haven', 'jsonlite'))"
            ),
            'jamovi': check_jamovi(jamovi_url),
        }

    mapped = ANALYSIS_MAP.get(analysis_type, analysis_type)
    payload: dict[str, Any] = {
        'dataFile': str(data_file),
        'analysisType': mapped,
        'variables': variables,
    }
    if group_by:
        payload['groupBy'] = group_by
    if dependent:
        payload['dependentVar'] = dependent
    if covariates:
        payload['covariates'] = covariates
    if options:
        payload['options'] = options
    if analysis_type.startswith('nonparametric'):
        payload['options'] = {**(options or {}), 'nonparametric': True}

    config_path = data_file.parent / f'.carina-jamovi-{os.getpid()}.json'
    try:
        config_path.write_text(json.dumps(payload), encoding='utf-8')
        completed = subprocess.run(
            ['Rscript', str(ANALYZE_R), str(config_path)],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        stdout = completed.stdout.strip()
        if not stdout:
            return {
                'error': completed.stderr.strip() or 'Jamovi analysis produced no output',
                'jamovi': check_jamovi(jamovi_url),
            }
        result = json.loads(stdout)
        if isinstance(result, dict):
            result['jamovi'] = check_jamovi(jamovi_url)
        return result
    except json.JSONDecodeError as exc:
        return {'error': f'Invalid analysis JSON: {exc}'}
    except subprocess.TimeoutExpired:
        return {'error': 'Jamovi analysis timed out after 120 seconds'}
    finally:
        try:
            config_path.unlink(missing_ok=True)
        except OSError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description='Carina Jamovi client')
    sub = parser.add_subparsers(dest='command', required=True)

    check_cmd = sub.add_parser('check')
    check_cmd.add_argument('--url', default=None)

    list_cmd = sub.add_parser('list')
    list_cmd.add_argument('--url', default=None)

    run_cmd = sub.add_parser('run')
    run_cmd.add_argument('--url', default=None)
    run_cmd.add_argument('--data', required=True)
    run_cmd.add_argument('--analysis', required=True)
    run_cmd.add_argument('--variables', required=True)
    run_cmd.add_argument('--group-by', default=None)
    run_cmd.add_argument('--dependent', default=None)
    run_cmd.add_argument('--covariates', default=None)
    run_cmd.add_argument('--options', default=None)

    args = parser.parse_args()

    if args.command == 'check':
        print(json.dumps(check_jamovi(args.url), indent=2))
        return 0

    if args.command == 'list':
        print(json.dumps(list_datasets(args.url), indent=2))
        return 0

    variables = [part.strip() for part in args.variables.split(',') if part.strip()]
    covariates = None
    if args.covariates:
        covariates = [part.strip() for part in args.covariates.split(',') if part.strip()]
    options = json.loads(args.options) if args.options else None

    result = run_analysis(
        args.data,
        args.analysis,
        variables,
        group_by=args.group_by,
        dependent=args.dependent,
        covariates=covariates,
        options=options,
        jamovi_url=args.url,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get('success') else 1


if __name__ == '__main__':
    raise SystemExit(main())
