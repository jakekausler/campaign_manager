/**
 * Calendar System Utilities
 *
 * Provides calendar-aware date parsing, formatting, and validation
 * for custom world calendars. Supports calendar definitions stored
 * in the World model's calendars JSON field.
 */

export interface CalendarDefinition {
  id: string;
  name: string;
  monthsPerYear: number;
  daysPerMonth: number[];
  monthNames: string[];
  epoch: string;
  notes?: string;
}

/**
 * Parse a world date string according to a calendar definition.
 * If no calendar is provided, uses standard ISO date parsing.
 *
 * @param dateString - Date string to parse (e.g., "15 Pharast 4707" or ISO format)
 * @param calendar - Optional calendar definition for parsing
 * @returns JavaScript Date object
 * @throws Error if date string is invalid or doesn't match calendar format
 */
export function parseWorldDate(dateString: string, calendar?: CalendarDefinition): Date {
  if (!calendar) {
    // No calendar provided - use standard ISO date parsing
    // For date-only strings (YYYY-MM-DD), ensure we get the correct local date
    const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      // Create date in local timezone to match test expectations
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid ISO date string: ${dateString}`);
      }
      return date;
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ISO date string: ${dateString}`);
    }
    return date;
  }

  // Try ISO format first (e.g., "4707-03-15T12:00:00Z")
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try custom calendar format: "DD MonthName YYYY" (e.g., "15 Pharast 4707")
  const customFormatMatch = dateString.match(
    /^(\d+)\s+([A-Za-z]+)\s+(\d+)(?:\s+(\d+):(\d+)(?::(\d+))?)?$/
  );
  if (!customFormatMatch) {
    throw new Error(
      `Invalid date format: ${dateString}. Expected "DD MonthName YYYY" or "DD MonthName YYYY HH:MM:SS" or ISO format`
    );
  }

  const [, dayStr, monthName, yearStr, hourStr, minuteStr, secondStr] = customFormatMatch;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  // Find month index by name (case-insensitive)
  const monthIndex = calendar.monthNames.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase()
  );
  if (monthIndex === -1) {
    throw new Error(
      `Invalid month name: ${monthName}. Valid months: ${calendar.monthNames.join(', ')}`
    );
  }

  // Validate day is within month's day count
  const daysInMonth = calendar.daysPerMonth[monthIndex];
  if (day < 1 || day > daysInMonth) {
    throw new Error(`Invalid day ${day} for month ${monthName}. Valid range: 1-${daysInMonth}`);
  }

  // Parse epoch to get base year (in UTC)
  const epochDate = new Date(calendar.epoch);
  const epochYear = epochDate.getUTCFullYear();

  // Calculate year offset from epoch
  const yearOffset = year - epochYear;

  // Build time components (interpret as local time, then convert to UTC for storage)
  const hour = hourStr ? parseInt(hourStr, 10) : 0;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
  const second = secondStr ? parseInt(secondStr, 10) : 0;

  // Calculate total days from epoch to this date
  const daysPerYear = calendar.daysPerMonth.reduce((sum, days) => sum + days, 0);
  let totalDays = yearOffset * daysPerYear;
  for (let i = 0; i < monthIndex; i++) {
    totalDays += calendar.daysPerMonth[i];
  }
  totalDays += day - 1; // -1 because day 1 is the first day

  // Create date from epoch + total days, using UTC to avoid timezone issues
  const resultDate = new Date(epochDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
  // Set time in local timezone (this will automatically convert to UTC for storage)
  resultDate.setHours(hour, minute, second, 0);

  return resultDate;
}

/**
 * Format a Date object according to a calendar definition.
 * If no calendar is provided, returns ISO string format.
 *
 * @param date - JavaScript Date to format
 * @param calendar - Optional calendar definition for formatting
 * @param includeTime - Whether to include time in format (default: false)
 * @returns Formatted date string
 */
export function formatWorldDate(
  date: Date,
  calendar?: CalendarDefinition,
  includeTime = false
): string {
  if (!calendar) {
    // No calendar provided - use ISO format
    return includeTime ? date.toISOString() : date.toISOString().split('T')[0];
  }

  // Calculate days since epoch (using UTC to avoid timezone issues)
  const epochDate = new Date(calendar.epoch);
  const epochYear = epochDate.getUTCFullYear();
  const millisecondsSinceEpoch = date.getTime() - epochDate.getTime();
  const daysSinceEpoch = Math.floor(millisecondsSinceEpoch / (1000 * 60 * 60 * 24));

  // Calculate year
  const daysPerYear = calendar.daysPerMonth.reduce((sum, days) => sum + days, 0);
  const yearsSinceEpoch = Math.floor(daysSinceEpoch / daysPerYear);
  const year = epochYear + yearsSinceEpoch;

  // Calculate month and day
  let remainingDays = daysSinceEpoch - yearsSinceEpoch * daysPerYear;
  let monthIndex = 0;
  while (
    monthIndex < calendar.daysPerMonth.length &&
    remainingDays >= calendar.daysPerMonth[monthIndex]
  ) {
    remainingDays -= calendar.daysPerMonth[monthIndex];
    monthIndex++;
  }

  // Handle edge case where we've gone past the last month
  if (monthIndex >= calendar.monthNames.length) {
    monthIndex = calendar.monthNames.length - 1;
  }

  const day = remainingDays + 1; // +1 because days are 1-indexed
  const monthName = calendar.monthNames[monthIndex];

  // Build formatted string
  let formatted = `${day} ${monthName} ${year}`;

  if (includeTime) {
    // Use UTC methods for formatting to preserve time consistently
    // This matches the behavior of ISO date strings which are typically in UTC
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    formatted += ` ${hours}:${minutes}:${seconds}`;
  }

  return formatted;
}

/**
 * Validate that a date is valid according to a calendar definition.
 * If no calendar is provided, validates as standard JavaScript Date.
 *
 * @param date - Date object to validate
 * @param calendar - Optional calendar definition for validation
 * @returns Object with isValid flag and optional error message
 */
export function validateWorldDate(
  date: Date,
  calendar?: CalendarDefinition
): { isValid: boolean; error?: string } {
  // Check if date is a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid Date object' };
  }

  if (!calendar) {
    // No calendar provided - just check if it's a valid Date
    return { isValid: true };
  }

  // Validate date is not before epoch
  const epochDate = new Date(calendar.epoch);
  if (date < epochDate) {
    return {
      isValid: false,
      error: `Date is before calendar epoch (${calendar.epoch})`,
    };
  }

  // Calculate which month and day this date falls on
  const millisecondsSinceEpoch = date.getTime() - epochDate.getTime();
  const daysSinceEpoch = Math.floor(millisecondsSinceEpoch / (1000 * 60 * 60 * 24));

  const daysPerYear = calendar.daysPerMonth.reduce((sum, days) => sum + days, 0);
  const yearsSinceEpoch = Math.floor(daysSinceEpoch / daysPerYear);
  let remainingDays = daysSinceEpoch - yearsSinceEpoch * daysPerYear;

  let monthIndex = 0;
  while (
    monthIndex < calendar.daysPerMonth.length &&
    remainingDays >= calendar.daysPerMonth[monthIndex]
  ) {
    remainingDays -= calendar.daysPerMonth[monthIndex];
    monthIndex++;
  }

  // Validate month is within calendar
  if (monthIndex >= calendar.monthNames.length) {
    return {
      isValid: false,
      error: `Calculated month index ${monthIndex} exceeds calendar months (${calendar.monthNames.length})`,
    };
  }

  // Validate day is within month's day count
  const day = remainingDays + 1;
  const daysInMonth = calendar.daysPerMonth[monthIndex];
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      error: `Day ${day} is invalid for month ${calendar.monthNames[monthIndex]} (valid: 1-${daysInMonth})`,
    };
  }

  return { isValid: true };
}
