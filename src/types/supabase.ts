export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      labels: {
        Row: {
          id: string
          created_at: string
          name: string
          color: string
          user_id: string
          is_driver_status: boolean
          is_pinned: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          color: string
          user_id: string
          is_driver_status?: boolean
          is_pinned?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          color?: string
          user_id?: string
          is_driver_status?: boolean
          is_pinned?: boolean
        }
      }
      tanker_entries: {
        Row: {
          id: string
          created_at: string
          date: string
          time: string
          cash_amount: number | null
          total_tankers: number | null
          label_id: string
          user_id: string
          driver_status: string | null
          total_km: number | null
          cash_taken: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          time: string
          cash_amount?: number | null
          total_tankers?: number | null
          label_id: string
          user_id: string
          driver_status?: string | null
          total_km?: number | null
          cash_taken?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          time?: string
          cash_amount?: number | null
          total_tankers?: number | null
          label_id?: string
          user_id?: string
          driver_status?: string | null
          total_km?: number | null
          cash_taken?: number | null
          notes?: string | null
        }
      }
    }
  }
}
