import { TankerEntry } from '../types';

/**
 * Groups tanker entries by date
 * @param entries Array of tanker entries
 * @returns Object with dates as keys and arrays of entries as values
 */
export const groupEntriesByDate = (entries: TankerEntry[]) => {
  return entries.reduce((acc, entry) => {
    const date = entry.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, TankerEntry[]>);
};

/**
 * Calculates the total cash amount for an array of tanker entries
 * @param entries Array of tanker entries
 * @returns Total cash amount
 */
export const calculateTotalCash = (entries: TankerEntry[]) => {
  return entries.reduce((total, entry) => {
    return total + (entry.cash_amount || 0);
  }, 0);
};

/**
 * Formats a number as currency
 * @param amount Number to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

/**
 * Validates that a time string is in a valid format (HH:MM)
 * @param time Time string
 * @returns True if valid, false otherwise
 */
export const isValidTime = (time: string) => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};