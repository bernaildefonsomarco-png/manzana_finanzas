export type EffectivePreference<T> = {
  value: T;
  source: "declared" | "observed";
  observed_value: T | null;
  observed_count: number;
};

/** RUL-MEM-14: una instrucción explícita nunca se reemplaza por frecuencia. */
export function resolveEffectivePreference<T>(input: {
  declared: { present: true; value: T } | { present: false };
  observed: { value: T; count: number } | null;
  fallback: T;
}): EffectivePreference<T> {
  if (input.declared.present) {
    return {
      value: input.declared.value,
      source: "declared",
      observed_value: input.observed?.value ?? null,
      observed_count: input.observed?.count ?? 0,
    };
  }
  if (input.observed) {
    return {
      value: input.observed.value,
      source: "observed",
      observed_value: input.observed.value,
      observed_count: input.observed.count,
    };
  }
  return { value: input.fallback, source: "observed", observed_value: null, observed_count: 0 };
}
