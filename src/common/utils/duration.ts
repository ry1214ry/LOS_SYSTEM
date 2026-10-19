// src/common/utils/duration.ts
const UNIT_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a duration such as `15m`, `7d`, `900s` or a bare number of seconds
 * into milliseconds. Mirrors the syntax accepted by `jsonwebtoken` for
 * `expiresIn`, so the cookie max-age and the JWT lifetime cannot drift.
 */
export function parseDurationToMs(value: string | number | undefined, fallbackMs: number): number {
  if (value === undefined) return fallbackMs;
  if (typeof value === 'number') return value * 1_000;

  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  return amount * (UNIT_MS[unit] ?? 1_000);
}
