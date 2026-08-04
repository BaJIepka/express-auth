const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${input}"`);
  }
  const [, value, unit] = match;
  return Number(value) * (unit ? (UNIT_SECONDS[unit] ?? 1) : 1);
}
