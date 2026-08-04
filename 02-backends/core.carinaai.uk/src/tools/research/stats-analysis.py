#!/usr/bin/env python3
"""Pure-Python statistical analysis for Carina research tools."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

try:
    import numpy as np
    import pandas as pd
    from scipy import stats
    import statsmodels.api as sm
    from statsmodels.stats.multicomp import pairwise_tukeyhsd
except ImportError:  # pragma: no cover
    np = None
    pd = None
    stats = None
    sm = None
    pairwise_tukeyhsd = None


def _require_stats_stack() -> None:
    if np is None or pd is None or stats is None or sm is None:
        raise RuntimeError(
            'Python stats stack missing. Run: pip install numpy pandas scipy statsmodels'
        )


def load_data(filepath: str) -> Any:
    _require_stats_stack()
    if filepath.lower().endswith('.sav'):
        import pyreadstat

        frame, _ = pyreadstat.read_sav(filepath)
        return frame
    return pd.read_csv(filepath)


def descriptive_stats(frame: pd.DataFrame, variables: list[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for var in variables:
        if var not in frame.columns:
            continue
        series = frame[var].dropna()
        results.append({
            'variable': var,
            'n': int(len(series)),
            'missing': int(frame[var].isna().sum()),
            'mean': round(float(series.mean()), 3) if len(series) else None,
            'std': round(float(series.std()), 3) if len(series) else None,
            'median': round(float(series.median()), 3) if len(series) else None,
            'min': round(float(series.min()), 3) if len(series) else None,
            'max': round(float(series.max()), 3) if len(series) else None,
            'skewness': round(float(series.skew()), 3) if len(series) else None,
            'kurtosis': round(float(series.kurtosis()), 3) if len(series) else None,
        })
    return results


def normality_test(frame: pd.DataFrame, variables: list[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for var in variables:
        if var not in frame.columns:
            continue
        series = frame[var].dropna()
        if len(series) < 3:
            continue
        if len(series) > 5000:
            stat, p_value = stats.kstest(series, 'norm', args=(series.mean(), series.std()))
            test_type = 'Kolmogorov-Smirnov'
        else:
            stat, p_value = stats.shapiro(series)
            test_type = 'Shapiro-Wilk'
        results.append({
            'variable': var,
            'test': test_type,
            'statistic': round(float(stat), 4),
            'p_value': round(float(p_value), 4),
            'normal': bool(p_value > 0.05),
        })
    return results


def ttest(frame: pd.DataFrame, variables: list[str], group_by: str) -> dict[str, Any] | list[dict[str, Any]]:
    groups = frame[group_by].dropna().unique()
    if len(groups) != 2:
        return {'error': f't-test requires exactly 2 groups. Found: {list(groups)}'}

    group_a, group_b = groups[0], groups[1]
    subset_a = frame[frame[group_by] == group_a]
    subset_b = frame[frame[group_by] == group_b]
    results: list[dict[str, Any]] = []

    for var in variables:
        if var == group_by or var not in frame.columns:
            continue
        t_stat, p_value = stats.ttest_ind(
            subset_a[var].dropna(),
            subset_b[var].dropna(),
            equal_var=False,
        )
        pooled_sd = np.sqrt((subset_a[var].std() ** 2 + subset_b[var].std() ** 2) / 2)
        cohens_d = (subset_a[var].mean() - subset_b[var].mean()) / pooled_sd if pooled_sd else 0.0
        results.append({
            'variable': var,
            'group1': str(group_a),
            'group1_mean': round(float(subset_a[var].mean()), 3),
            'group2': str(group_b),
            'group2_mean': round(float(subset_b[var].mean()), 3),
            't_statistic': round(float(t_stat), 3),
            'df': int(len(subset_a) + len(subset_b) - 2),
            'p_value': round(float(p_value), 4),
            'significant': bool(p_value < 0.05),
            'cohens_d': round(float(cohens_d), 3),
        })
    return results


def mann_whitney(frame: pd.DataFrame, variables: list[str], group_by: str) -> dict[str, Any] | list[dict[str, Any]]:
    groups = frame[group_by].dropna().unique()
    if len(groups) != 2:
        return {'error': f'Mann-Whitney requires exactly 2 groups. Found: {list(groups)}'}

    group_a, group_b = groups[0], groups[1]
    subset_a = frame[frame[group_by] == group_a]
    subset_b = frame[frame[group_by] == group_b]
    results: list[dict[str, Any]] = []

    for var in variables:
        if var == group_by or var not in frame.columns:
            continue
        u_stat, p_value = stats.mannwhitneyu(
            subset_a[var].dropna(),
            subset_b[var].dropna(),
            alternative='two-sided',
        )
        results.append({
            'variable': var,
            'test': 'Mann-Whitney U',
            'group1': str(group_a),
            'group2': str(group_b),
            'u_statistic': round(float(u_stat), 3),
            'p_value': round(float(p_value), 4),
            'significant': bool(p_value < 0.05),
        })
    return results


def kruskal_wallis(frame: pd.DataFrame, variables: list[str], group_by: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for var in variables:
        if var == group_by or var not in frame.columns:
            continue
        groups_data = [
            group[var].dropna().values
            for _, group in frame.groupby(group_by)
            if var in group.columns
        ]
        if len(groups_data) < 2:
            continue
        h_stat, p_value = stats.kruskal(*groups_data)
        results.append({
            'variable': var,
            'test': 'Kruskal-Wallis H',
            'h_statistic': round(float(h_stat), 3),
            'p_value': round(float(p_value), 4),
            'significant': bool(p_value < 0.05),
        })
    return results


def anova(frame: pd.DataFrame, variables: list[str], group_by: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for var in variables:
        if var == group_by or var not in frame.columns:
            continue
        groups_data = [
            group[var].dropna().values
            for _, group in frame.groupby(group_by)
            if var in group.columns
        ]
        if len(groups_data) < 2:
            continue
        f_stat, p_value = stats.f_oneway(*groups_data)
        grand_mean = frame[var].mean()
        ss_between = sum(len(group) * (group.mean() - grand_mean) ** 2 for group in groups_data)
        ss_total = sum((frame[var].dropna() - grand_mean) ** 2)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0.0
        results.append({
            'variable': var,
            'f_statistic': round(float(f_stat), 3),
            'df_between': len(groups_data) - 1,
            'df_within': sum(len(group) for group in groups_data) - len(groups_data),
            'p_value': round(float(p_value), 4),
            'significant': bool(p_value < 0.05),
            'eta_squared': round(float(eta_sq), 3),
        })
    return results


def correlation_matrix(frame: pd.DataFrame, variables: list[str], method: str = 'pearson') -> list[dict[str, Any]]:
    corr_df = frame[variables].corr(method=method)
    results: list[dict[str, Any]] = []
    for i, var1 in enumerate(variables):
        for j, var2 in enumerate(variables):
            if i >= j:
                continue
            pair = frame[[var1, var2]].dropna()
            if method == 'spearman':
                corr_value = pair[var1].corr(pair[var2], method='spearman')
                _, p_value = stats.spearmanr(pair[var1], pair[var2])
            else:
                corr_value = pair[var1].corr(pair[var2], method='pearson')
                _, p_value = stats.pearsonr(pair[var1], pair[var2])
            results.append({
                'var1': var1,
                'var2': var2,
                'correlation': round(float(corr_value), 3),
                'p_value': round(float(p_value), 4),
                'significant': bool(p_value < 0.05),
                'method': method,
            })
    return results


def linear_regression(frame: pd.DataFrame, dependent: str, independents: list[str]) -> dict[str, Any]:
    subset = frame[[dependent, *independents]].dropna()
    y = subset[dependent]
    x = sm.add_constant(subset[independents])
    model = sm.OLS(y, x).fit()
    return {
        'dependent': dependent,
        'independents': independents,
        'r_squared': round(float(model.rsquared), 3),
        'adj_r_squared': round(float(model.rsquared_adj), 3),
        'f_statistic': round(float(model.fvalue), 3),
        'f_p_value': round(float(model.f_pvalue), 4),
        'coefficients': [
            {
                'variable': name,
                'coefficient': round(float(coef), 4),
                'std_error': round(float(model.bse[name]), 4),
                't_statistic': round(float(model.tvalues[name]), 3),
                'p_value': round(float(model.pvalues[name]), 4),
                'significant': bool(model.pvalues[name] < 0.05),
            }
            for name, coef in model.params.items()
        ],
        'n': int(len(y)),
    }


def logistic_regression(frame: pd.DataFrame, dependent: str, independents: list[str]) -> dict[str, Any]:
    subset = frame[[dependent, *independents]].dropna()
    y = subset[dependent]
    x = sm.add_constant(subset[independents])
    model = sm.Logit(y, x).fit(disp=0)
    return {
        'dependent': dependent,
        'independents': independents,
        'regression_type': 'logistic',
        'pseudo_r_squared': round(float(model.prsquared), 3),
        'llr_p_value': round(float(model.llr_pvalue), 4),
        'coefficients': [
            {
                'variable': name,
                'coefficient': round(float(coef), 4),
                'std_error': round(float(model.bse[name]), 4),
                'z_statistic': round(float(model.tvalues[name]), 3),
                'p_value': round(float(model.pvalues[name]), 4),
                'odds_ratio': round(float(np.exp(coef)), 4),
                'significant': bool(model.pvalues[name] < 0.05),
            }
            for name, coef in model.params.items()
        ],
        'n': int(len(y)),
    }


def regression(
    frame: pd.DataFrame,
    dependent: str,
    independents: list[str],
    regression_type: str = 'linear',
) -> dict[str, Any]:
    if regression_type == 'logistic':
        return logistic_regression(frame, dependent, independents)
    return linear_regression(frame, dependent, independents)


def chi_square_test(frame: pd.DataFrame, variables: list[str]) -> dict[str, Any]:
    if len(variables) < 2:
        return {'error': 'chi_square requires two categorical variables'}
    row_var, col_var = variables[0], variables[1]
    table = pd.crosstab(frame[row_var], frame[col_var])
    chi2, p_value, dof, expected = stats.chi2_contingency(table)
    n = table.to_numpy().sum()
    min_dim = min(table.shape[0] - 1, table.shape[1] - 1)
    cramers_v = np.sqrt(chi2 / (n * min_dim)) if n > 0 and min_dim > 0 else 0.0
    return {
        'row_variable': row_var,
        'column_variable': col_var,
        'chi_square': round(float(chi2), 3),
        'df': int(dof),
        'p_value': round(float(p_value), 4),
        'significant': bool(p_value < 0.05),
        'cramers_v': round(float(cramers_v), 3),
        'table': table.reset_index().to_dict(orient='records'),
    }


def posthoc_tukey(frame: pd.DataFrame, variable: str, group_by: str) -> dict[str, Any]:
    subset = frame[[variable, group_by]].dropna()
    if subset[group_by].nunique() < 2:
        return {'error': 'posthoc requires at least two groups'}
    result = pairwise_tukeyhsd(subset[variable], subset[group_by])
    rows = []
    for idx in range(len(result.summary().data) - 1):
        row = result.summary().data[idx + 1]
        rows.append({
            'group1': str(row[0]),
            'group2': str(row[1]),
            'mean_diff': round(float(row[2]), 3),
            'p_adj': round(float(row[3]), 4),
            'significant': bool(float(row[3]) < 0.05),
        })
    return {
        'variable': variable,
        'group_by': group_by,
        'method': 'tukey',
        'comparisons': rows,
    }


def check_dependencies() -> dict[str, bool]:
    available = {
        'numpy': np is not None,
        'pandas': pd is not None,
        'scipy': stats is not None,
        'statsmodels': sm is not None and pairwise_tukeyhsd is not None,
        'pyreadstat': False,
    }
    if available['pandas']:
        try:
            import pyreadstat  # noqa: F401

            available['pyreadstat'] = True
        except ImportError:
            pass
    return available


COMMANDS = {
    'descriptive': descriptive_stats,
    'normality': normality_test,
    'ttest': ttest,
    'mann_whitney': mann_whitney,
    'anova': anova,
    'kruskal_wallis': kruskal_wallis,
    'correlation': correlation_matrix,
    'regression': regression,
    'chi_square': chi_square_test,
    'posthoc': posthoc_tukey,
}


def main() -> int:
    parser = argparse.ArgumentParser(description='Carina Python statistical analysis')
    sub = parser.add_subparsers(dest='command', required=True)

    deps_cmd = sub.add_parser('deps')
    run_cmd = sub.add_parser('run')
    run_cmd.add_argument('--analysis', required=True, choices=sorted(COMMANDS.keys()))
    run_cmd.add_argument('--file', required=True)
    run_cmd.add_argument('--variables', required=True)
    run_cmd.add_argument('--group-by')
    run_cmd.add_argument('--dependent')
    run_cmd.add_argument('--method', default='pearson')
    run_cmd.add_argument('--regression-type', default='linear', choices=['linear', 'logistic'])

    args = parser.parse_args()

    if args.command == 'deps':
        print(json.dumps(check_dependencies(), indent=2))
        return 0

    variables = [part.strip() for part in args.variables.split(',') if part.strip()]
    try:
        _require_stats_stack()
        frame = load_data(args.file)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({'error': str(exc)}))
        return 1

    func = COMMANDS[args.analysis]
    if args.analysis in {'ttest', 'anova', 'mann_whitney', 'kruskal_wallis', 'posthoc'}:
        if not args.group_by:
            print(json.dumps({'error': f'{args.analysis} requires --group-by'}))
            return 1
        if args.analysis == 'posthoc':
            result = func(frame, variables[0], args.group_by)
        else:
            result = func(frame, variables, args.group_by)
    elif args.analysis == 'regression':
        if not args.dependent:
            print(json.dumps({'error': 'regression requires --dependent'}))
            return 1
        result = func(frame, args.dependent, variables, regression_type=args.regression_type)
    elif args.analysis == 'chi_square':
        result = func(frame, variables)
    elif args.analysis == 'correlation':
        result = func(frame, variables, method=args.method)
    else:
        result = func(frame, variables)

    print(json.dumps({'analysis': args.analysis, 'results': result}, indent=2, default=str))
    return 0 if not (isinstance(result, dict) and result.get('error')) else 1


if __name__ == '__main__':
    raise SystemExit(main())
