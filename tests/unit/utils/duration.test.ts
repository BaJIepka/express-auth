import { parseDurationToSeconds } from '@/utils/duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604800],
    ['0s', 0],
    ['100', 100],
  ])('parses "%s" as %d seconds', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDurationToSeconds('  15m  ')).toBe(900);
  });

  it.each(['', 'abc', '10x', '-5m', '5.5m', 'm5'])('throws for invalid input "%s"', (input) => {
    expect(() => parseDurationToSeconds(input)).toThrow(/Invalid duration format/);
  });
});
