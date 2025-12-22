import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

// Parse a date string (YYYY-MM-DD) as local time, not UTC
// This fixes timezone issues where "2025-12-15" parsed by new Date() becomes Dec 14 in western timezones
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // noon to avoid any DST issues
};

// Helper to convert Firestore Timestamp or serialized timestamp to Date
export const toDate = (value: unknown): Date => {
  if (!value) return new Date();

  // Already a Date object
  if (value instanceof Date) return value;

  // Firestore Timestamp with toDate method
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  // Serialized Firestore Timestamp (has seconds and nanoseconds)
  if (typeof value === 'object' && 'seconds' in value) {
    const ts = value as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  }

  // String or number
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return new Date();
};

export interface PeriodBoundaries {
  startDate: Date;
  endDate: Date;
  periodIdentifier: string;
  periodNumber: 1 | 15;
}

export const getPeriodBoundaries = (
  date: Date,
  payDays: [number, number] = [1, 15]
): PeriodBoundaries => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const [firstPayDay, secondPayDay] = payDays;
  const dayOfMonth = date.getDate();

  if (dayOfMonth < secondPayDay) {
    // First period of the month
    const startDate = new Date(year, month, firstPayDay);
    const endDate = new Date(year, month, secondPayDay - 1);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate,
      endDate,
      periodIdentifier: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      periodNumber: 1,
    };
  } else {
    // Second period of the month
    const startDate = new Date(year, month, secondPayDay);
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const endDate = new Date(year, month, lastDayOfMonth);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate,
      endDate,
      periodIdentifier: `${year}-${String(month + 1).padStart(2, '0')}-15`,
      periodNumber: 15,
    };
  }
};

export const getNextPeriodBoundaries = (
  currentEndDate: Date,
  payDays: [number, number] = [1, 15]
): PeriodBoundaries => {
  const nextDay = new Date(currentEndDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return getPeriodBoundaries(nextDay, payDays);
};

export const formatPeriodRange = (startDate: Date, endDate: Date): string => {
  const startMonth = format(startDate, 'MMM');
  const endMonth = format(endDate, 'MMM');

  if (startMonth === endMonth) {
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`;
  }
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
};

export const formatShortDate = (date: Date): string => {
  return format(date, 'MMM d');
};

export const formatFullDate = (date: Date): string => {
  return format(date, 'MMMM d, yyyy');
};

export const isDateInCurrentMonth = (date: Date): boolean => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  return isWithinInterval(date, { start: monthStart, end: monthEnd });
};

export const areDatesInSameMonth = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth()
  );
};
