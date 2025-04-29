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
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          color: string
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          color?: string
          user_id?: string
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
        }
      }
    }
  }
}