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
  is_driver_status: boolean;
  is_pinned: boolean;
  diesel_average: number;
  current_range: number;
}

export interface TankerEntry {
  id: string;
  date: string;
  time: string;
  cash_amount: number | null;
  total_tankers: number | null;
  label_id: string;
  user_id: string;
  created_at: string;
  driver_status: 'present' | 'absent' | null;
  total_km: number | null;
  cash_taken: number | null;
  notes: string | null;
  diesel_added: number;
}

export interface DailyEntries {
  day: number;
  entries: TankerEntry[];
  totalTankers: number;
  totalCash: number;
  totalKm: number;
  totalCashTaken: number;
  presentCount: number;
  absentCount: number;
  totalDieselAdded: number;
}

export interface MonthlyData {
  dailyEntries: Record<string, DailyEntries>;
  totalTankers: number;
  totalCash: number;
  totalKm: number;
  totalCashTaken: number;
  totalPresentCount: number;
  totalAbsentCount: number;
  totalDieselAdded: number;
}

export interface MonthlyFuelData {
  id: string;
  label_id: string;
  user_id: string;
  month: number;
  year: number;
  diesel_average: number;
  total_diesel_added: number;
  total_km_driven: number;
  carried_range: number;
  current_range: number;
  is_average_locked: boolean;
  created_at: string;
}
