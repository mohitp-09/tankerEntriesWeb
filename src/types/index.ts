export interface User {
  id: string;
  email: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface TankerEntry {
  id: string;
  date: string;
  time: string;
  cash_amount: number | null;
  label_id: string;
  user_id: string;
  created_at: string;
}

export interface DailyEntries {
  day: number;
  entries: TankerEntry[];
  totalTankers: number;
  totalCash: number;
}

export interface MonthlyData {
  dailyEntries: Record<string, DailyEntries>;
  totalTankers: number;
  totalCash: number;
}