import { parseDurationMs } from '../duration.util';

describe('duration.util', () => {
  describe('parseDurationMs', () => {
    it.each([
      ['30s', 30_000],
      ['15m', 900_000],
      ['2h', 7_200_000],
      ['7d', 604_800_000],
    ])('should convert %s to %d ms', (input, expected) => {
      expect(parseDurationMs(input)).toBe(expected);
    });

    it.each(['', '15', 'm', '15x', '1.5h', '-1d', ' 7d', '7d ', '7 d', '7D'])(
      'should throw on invalid input "%s"',
      (input) => {
        expect(() => parseDurationMs(input)).toThrow('Invalid duration');
      },
    );
  });
});
