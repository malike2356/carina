import type { DeepPartial } from './types';

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  partial: DeepPartial<T>,
): T {
  const out = { ...base };
  for (const key of Object.keys(partial) as (keyof T)[]) {
    const partialValue = partial[key];
    const baseValue = base[key];
    if (
      partialValue &&
      typeof partialValue === 'object' &&
      !Array.isArray(partialValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      out[key] = deepMerge(
        baseValue as Record<string, unknown>,
        partialValue as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T];
    } else if (partialValue !== undefined) {
      out[key] = partialValue as T[keyof T];
    }
  }
  return out;
}
