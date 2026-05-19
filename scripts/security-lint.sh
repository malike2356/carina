#!/usr/bin/env bash
# Security-focused code pattern scan
# Fails the build if dangerous patterns are found

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Security Lint ==="

ERRORS=0

# 1. eval() usage (almost always dangerous; legitimate uses must use // security-lint-ignore)
EVAL_COUNT=$(grep -rn --include="*.php" "\beval\s*(" app/ | grep -v "security-lint-ignore" | wc -l || true)
if [ "$EVAL_COUNT" -gt 0 ]; then
    echo "ERROR: eval() found in app/ ($EVAL_COUNT occurrences)"
    grep -rn --include="*.php" "\beval\s*(" app/ | grep -v "security-lint-ignore" || true
    ERRORS=$((ERRORS + 1))
fi

# 2. shell_exec, exec, system, passthru, popen
SHELL_COUNT=$(grep -rn --include="*.php" "\b\(shell_exec\|passthru\|popen\|proc_open\)\s*(" app/ | grep -v "security-lint-ignore" | wc -l || true)
if [ "$SHELL_COUNT" -gt 0 ]; then
    echo "ERROR: Dangerous shell function found ($SHELL_COUNT occurrences)"
    grep -rn --include="*.php" "\b\(shell_exec\|passthru\|popen\|proc_open\)\s*(" app/ | grep -v "security-lint-ignore" || true
    ERRORS=$((ERRORS + 1))
fi

# 3. md5() or sha1() used for passwords (must use bcrypt/argon)
MD5_COUNT=$(grep -rn --include="*.php" "\bmd5\s*(\$.*password\|.*hash.*md5" app/ | wc -l || true)
if [ "$MD5_COUNT" -gt 0 ]; then
    echo "ERROR: md5/sha1 used for password hashing ($MD5_COUNT occurrences)"
    ERRORS=$((ERRORS + 1))
fi

# 4. Hardcoded credentials patterns
CRED_COUNT=$(grep -rn --include="*.php" -i "password\s*=\s*['\"][^'\"]\{6,\}['\"]" app/ | grep -v "security-lint-ignore" | wc -l || true)
if [ "$CRED_COUNT" -gt 0 ]; then
    echo "WARNING: Possible hardcoded credential ($CRED_COUNT occurrences) - review manually"
fi

# 5. Unescaped output in Blade: check for increase vs baseline
BLADE_UNESCAPED=$(grep -rn "{!!" resources/views/ | grep -v "safe: platform-controlled" | wc -l || true)
BASELINE=26
if [ "$BLADE_UNESCAPED" -gt "$BASELINE" ]; then
    echo "ERROR: Unescaped Blade output {!! !!} count ($BLADE_UNESCAPED) exceeds baseline ($BASELINE)"
    ERRORS=$((ERRORS + 1))
fi

echo "Security lint complete. Errors: $ERRORS"
exit "$ERRORS"
