import {
  CalendarDefinition,
  formatWorldDate,
  parseWorldDate,
  validateWorldDate,
} from './calendar.utils';

// Test calendar based on Absalom Reckoning from seed data
const absalomReckoning: CalendarDefinition = {
  id: 'absalom-reckoning',
  name: 'Absalom Reckoning',
  monthsPerYear: 12,
  daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  monthNames: [
    'Abadius',
    'Calistril',
    'Pharast',
    'Gozran',
    'Desnus',
    'Sarenith',
    'Erastus',
    'Arodus',
    'Rova',
    'Lamashan',
    'Neth',
    'Kuthona',
  ],
  epoch: '4700-01-01T00:00:00Z',
  notes: 'The standard calendar of Golarion',
};

describe('parseWorldDate', () => {
  describe('without calendar (ISO format)', () => {
    it('should parse valid ISO date string', () => {
      const result = parseWorldDate('2024-03-15T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-03-15T12:00:00.000Z');
    });

    it('should parse simple date string', () => {
      const result = parseWorldDate('2024-03-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(2); // 0-indexed, so March is 2
      expect(result.getDate()).toBe(15);
    });

    it('should throw error for invalid date string', () => {
      expect(() => parseWorldDate('invalid-date')).toThrow('Invalid ISO date string');
    });
  });

  describe('with calendar (custom format)', () => {
    it('should parse ISO format even with calendar provided', () => {
      const result = parseWorldDate('4707-03-15T12:00:00Z', absalomReckoning);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('4707-03-15T12:00:00.000Z');
    });

    it('should parse custom calendar format "DD MonthName YYYY"', () => {
      const result = parseWorldDate('15 Pharast 4707', absalomReckoning);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(4707);
    });

    it('should parse custom format with time "DD MonthName YYYY HH:MM:SS"', () => {
      const result = parseWorldDate('15 Pharast 4707 14:30:45', absalomReckoning);
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(45);
    });

    it('should parse custom format with partial time "DD MonthName YYYY HH:MM"', () => {
      const result = parseWorldDate('15 Pharast 4707 14:30', absalomReckoning);
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
    });

    it('should be case-insensitive for month names', () => {
      const result1 = parseWorldDate('15 pharast 4707', absalomReckoning);
      const result2 = parseWorldDate('15 PHARAST 4707', absalomReckoning);
      const result3 = parseWorldDate('15 Pharast 4707', absalomReckoning);

      expect(result1.getTime()).toBe(result2.getTime());
      expect(result2.getTime()).toBe(result3.getTime());
    });

    it('should throw error for invalid month name', () => {
      expect(() => parseWorldDate('15 InvalidMonth 4707', absalomReckoning)).toThrow(
        /Invalid month name/
      );
    });

    it('should throw error for day out of range', () => {
      // Calistril (Feb) has 28 days
      expect(() => parseWorldDate('29 Calistril 4707', absalomReckoning)).toThrow(
        /Invalid day 29 for month Calistril/
      );
    });

    it('should throw error for day 0', () => {
      expect(() => parseWorldDate('0 Pharast 4707', absalomReckoning)).toThrow(
        /Invalid day 0 for month Pharast/
      );
    });

    it('should throw error for invalid format', () => {
      expect(() => parseWorldDate('invalid format', absalomReckoning)).toThrow(
        /Invalid date format/
      );
    });

    it('should accept valid days for each month', () => {
      // Abadius has 31 days
      expect(() => parseWorldDate('31 Abadius 4707', absalomReckoning)).not.toThrow();

      // Calistril has 28 days
      expect(() => parseWorldDate('28 Calistril 4707', absalomReckoning)).not.toThrow();

      // Gozran has 30 days
      expect(() => parseWorldDate('30 Gozran 4707', absalomReckoning)).not.toThrow();
    });
  });
});

describe('formatWorldDate', () => {
  describe('without calendar (ISO format)', () => {
    it('should format date as ISO string without time', () => {
      const date = new Date('2024-03-15T12:30:45Z');
      const result = formatWorldDate(date);
      expect(result).toBe('2024-03-15');
    });

    it('should format date as ISO string with time when requested', () => {
      const date = new Date('2024-03-15T12:30:45.123Z');
      const result = formatWorldDate(date, undefined, true);
      expect(result).toBe('2024-03-15T12:30:45.123Z');
    });
  });

  describe('with calendar (custom format)', () => {
    it('should format date in custom calendar format without time', () => {
      const date = new Date('4707-03-15T12:00:00Z');
      const result = formatWorldDate(date, absalomReckoning);
      // 15 Pharast 4707 - This is approximately 7 years after epoch
      expect(result).toMatch(/\d+ \w+ \d+/);
      expect(result).toContain('4707');
    });

    it('should format date in custom calendar format with time', () => {
      const date = new Date('4707-03-15T14:30:45Z');
      const result = formatWorldDate(date, absalomReckoning, true);
      expect(result).toMatch(/\d+ \w+ \d+ \d{2}:\d{2}:\d{2}/);
      expect(result).toContain('14:30:45');
    });

    it('should format epoch date correctly', () => {
      const date = new Date('4700-01-01T00:00:00Z');
      const result = formatWorldDate(date, absalomReckoning);
      expect(result).toBe('1 Abadius 4700');
    });

    it('should format dates at year boundaries correctly', () => {
      // Last day of first month
      const date1 = new Date('4700-01-31T00:00:00Z');
      const result1 = formatWorldDate(date1, absalomReckoning);
      expect(result1).toBe('31 Abadius 4700');

      // First day of second month
      const date2 = new Date('4700-02-01T00:00:00Z');
      const result2 = formatWorldDate(date2, absalomReckoning);
      expect(result2).toBe('1 Calistril 4700');
    });

    it('should pad time values with zeros', () => {
      const date = new Date('4707-03-15T01:05:09Z');
      const result = formatWorldDate(date, absalomReckoning, true);
      expect(result).toContain('01:05:09');
    });
  });
});

describe('validateWorldDate', () => {
  describe('without calendar', () => {
    it('should validate a valid Date object', () => {
      const date = new Date('2024-03-15T12:00:00Z');
      const result = validateWorldDate(date);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid Date object', () => {
      const date = new Date('invalid');
      const result = validateWorldDate(date);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid Date object');
    });

    it('should reject non-Date objects', () => {
      const result = validateWorldDate('not a date' as unknown as Date);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid Date object');
    });
  });

  describe('with calendar', () => {
    it('should validate a date within calendar range', () => {
      const date = new Date('4707-03-15T12:00:00Z');
      const result = validateWorldDate(date, absalomReckoning);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject a date before epoch', () => {
      const date = new Date('4699-12-31T23:59:59Z');
      const result = validateWorldDate(date, absalomReckoning);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('before calendar epoch');
    });

    it('should validate date exactly at epoch', () => {
      const date = new Date('4700-01-01T00:00:00Z');
      const result = validateWorldDate(date, absalomReckoning);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate dates far in the future', () => {
      const date = new Date('5000-01-01T00:00:00Z');
      const result = validateWorldDate(date, absalomReckoning);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate dates in different months', () => {
      // First month
      const date1 = new Date('4707-01-15T12:00:00Z');
      const result1 = validateWorldDate(date1, absalomReckoning);
      expect(result1.isValid).toBe(true);

      // Last month
      const date2 = new Date('4707-12-15T12:00:00Z');
      const result2 = validateWorldDate(date2, absalomReckoning);
      expect(result2.isValid).toBe(true);
    });
  });
});

describe('Calendar utilities integration', () => {
  it('should round-trip: parse then format returns similar date', () => {
    const originalString = '15 Pharast 4707';
    const parsed = parseWorldDate(originalString, absalomReckoning);
    const formatted = formatWorldDate(parsed, absalomReckoning);

    // Should be the same date (may differ slightly due to time component)
    expect(formatted).toContain('4707');
    expect(formatted).toContain('Pharast');
  });

  it('should validate parsed dates as valid', () => {
    const dateString = '15 Pharast 4707';
    const parsed = parseWorldDate(dateString, absalomReckoning);
    const validation = validateWorldDate(parsed, absalomReckoning);

    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('should handle null/undefined calendar consistently', () => {
    const date = new Date('2024-03-15T12:00:00Z');

    const formatted1 = formatWorldDate(date);
    const formatted2 = formatWorldDate(date, undefined);
    expect(formatted1).toBe(formatted2);

    const validated1 = validateWorldDate(date);
    const validated2 = validateWorldDate(date, undefined);
    expect(validated1.isValid).toBe(validated2.isValid);

    const isoString = '2024-03-15T12:00:00Z';
    const parsed1 = parseWorldDate(isoString);
    const parsed2 = parseWorldDate(isoString, undefined);
    expect(parsed1.getTime()).toBe(parsed2.getTime());
  });
});
