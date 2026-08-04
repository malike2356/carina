import { runInSandbox } from './sandbox-factory.js';
import { DEFAULT_SANDBOX_OPTIONS, RESULT_MARKER } from './sandbox-vm.js';
import type { SandboxOptions, SandboxResult } from './sandbox-vm.js';

/**
 * Execute a generated tool function in the sandbox and capture its structured return value.
 *
 * The generated function must be named `execute(params)`. The engine wraps it
 * with code that JSON-serializes the return value to stdout using a known marker,
 * then parses it back after the sandbox run.
 */
export async function executeInSandbox(
  generatedCode: string,
  params: Record<string, unknown>,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
  const start = Date.now();

  // Embed params as JSON so the sandbox receives them without process.env access
  let paramsJson: string;
  try {
    paramsJson = JSON.stringify(params);
  } catch {
    return { success: false, error: 'params are not JSON-serializable', durationMs: 0 };
  }

  // Wrap the generated function: inject params, call execute(), emit result marker
  const wrappedCode = `
${generatedCode}

(async () => {
  try {
    const params = JSON.parse(${JSON.stringify(paramsJson)});
    const result = await execute(params);
    const serialized = JSON.stringify(result);
    if (serialized === undefined) {
      console.log('${RESULT_MARKER}' + JSON.stringify(null));
    } else {
      console.log('${RESULT_MARKER}' + serialized);
    }
  } catch (err) {
    console.log('${RESULT_MARKER}' + JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
})();
`.trim();

  const sandboxOut = await runInSandbox(wrappedCode, 'javascript', opts.timeout, {
    memoryMb: opts.memoryLimitMb,
    networkDisabled: false,
  });

  const durationMs = Date.now() - start;

  if (sandboxOut.exitCode !== 0) {
    return {
      success: false,
      error: sandboxOut.stderr.replace('${RESULT_MARKER}', '').trim() || 'Sandbox exited with error',
      durationMs,
      tier: sandboxOut.sandboxTier,
    };
  }

  // Extract structured result from stdout
  const markerIdx = sandboxOut.stdout.indexOf(RESULT_MARKER);
  if (markerIdx === -1) {
    return {
      success: false,
      error: `No result marker in sandbox output. stdout: ${sandboxOut.stdout.slice(0, 500)}`,
      durationMs,
      tier: sandboxOut.sandboxTier,
    };
  }

  const rawResult = sandboxOut.stdout.slice(markerIdx + RESULT_MARKER.length).split('\n')[0] ?? '';

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResult);
  } catch {
    return {
      success: false,
      error: `Could not parse sandbox result: ${rawResult.slice(0, 500)}`,
      durationMs,
      tier: sandboxOut.sandboxTier,
    };
  }

  // Check output size
  const outputSize = Buffer.byteLength(rawResult);
  if (outputSize > opts.outputLimitBytes) {
    return {
      success: false,
      error: `Output exceeds ${opts.outputLimitBytes} byte limit (got ${outputSize} bytes).`,
      durationMs,
      tier: sandboxOut.sandboxTier,
    };
  }

  // If the result itself contains an error field, surface it
  if (parsed && typeof parsed === 'object' && 'error' in (parsed as Record<string, unknown>)) {
    const errorVal = (parsed as Record<string, unknown>).error;
    if (typeof errorVal === 'string' && Object.keys(parsed as object).length === 1) {
      return { success: false, error: errorVal, durationMs, tier: sandboxOut.sandboxTier };
    }
  }

  return { success: true, result: parsed, durationMs, tier: sandboxOut.sandboxTier };
}
