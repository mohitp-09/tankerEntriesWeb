/*
  # Month-wise Fuel Tracking System

  ## Overview
  Implements a monthly diesel tracking system where each month maintains separate data
  while automatically carrying forward remaining range from previous months.

  ## 1. New Table: monthly_fuel_data
    - `id` (uuid, primary key) - Unique identifier
    - `label_id` (uuid, foreign key) - References labels table
    - `user_id` (uuid, foreign key) - References auth.users
    - `month` (integer) - Month number (1-12)
    - `year` (integer) - Year (e.g., 2025)
    - `diesel_average` (numeric) - Vehicle average for this month (km/l)
    - `total_diesel_added` (numeric) - Total diesel added this month (liters)
    - `total_km_driven` (numeric) - Total kilometers driven this month
    - `carried_range` (numeric) - Range carried forward from previous month (km)
    - `current_range` (numeric) - Current remaining range for this month (km)
    - `is_average_locked` (boolean) - Lock average after first diesel addition
    - `created_at` (timestamptz) - Timestamp of creation

  ## 2. Security
    - Enable RLS on monthly_fuel_data table
    - Policy: Users can read their own monthly fuel data
    - Policy: Users can insert their own monthly fuel data
    - Policy: Users can update their own monthly fuel data
    - Policy: Users can delete their own monthly fuel data

  ## 3. Data Migration
    - Migrate existing diesel_average and current_range from labels table
    - Create monthly records for existing data if applicable

  ## 4. Important Notes
    - Each month starts with a blank average (user must set it)
    - Once diesel is added for a month, the average is locked
    - Remaining range from previous month auto-carries forward
    - Composite unique constraint on (label_id, year, month)
*/

-- Create monthly_fuel_data table
CREATE TABLE IF NOT EXISTS monthly_fuel_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000),
  diesel_average numeric DEFAULT 0 CHECK (diesel_average >= 0),
  total_diesel_added numeric DEFAULT 0 CHECK (total_diesel_added >= 0),
  total_km_driven numeric DEFAULT 0 CHECK (total_km_driven >= 0),
  carried_range numeric DEFAULT 0 CHECK (carried_range >= 0),
  current_range numeric DEFAULT 0 CHECK (current_range >= 0),
  is_average_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(label_id, year, month)
);

-- Enable RLS
ALTER TABLE monthly_fuel_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own monthly fuel data"
  ON monthly_fuel_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly fuel data"
  ON monthly_fuel_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly fuel data"
  ON monthly_fuel_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly fuel data"
  ON monthly_fuel_data
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_fuel_data_label_id ON monthly_fuel_data(label_id);
CREATE INDEX IF NOT EXISTS idx_monthly_fuel_data_user_id ON monthly_fuel_data(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_fuel_data_year_month ON monthly_fuel_data(year, month);

-- Migrate existing data from labels table to monthly_fuel_data
-- This creates current month records for labels that have diesel_average or current_range set
DO $$
DECLARE
  label_record RECORD;
  current_month integer;
  current_year integer;
BEGIN
  -- Get current month and year
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Loop through labels with existing diesel data
  FOR label_record IN 
    SELECT id, user_id, diesel_average, current_range
    FROM labels
    WHERE is_driver_status = true 
      AND (diesel_average > 0 OR current_range > 0)
  LOOP
    -- Insert monthly record if it doesn't exist
    INSERT INTO monthly_fuel_data (
      label_id, 
      user_id, 
      month, 
      year, 
      diesel_average, 
      carried_range,
      current_range,
      is_average_locked
    )
    VALUES (
      label_record.id,
      label_record.user_id,
      current_month,
      current_year,
      label_record.diesel_average,
      0,
      label_record.current_range,
      CASE WHEN label_record.diesel_average > 0 THEN true ELSE false END
    )
    ON CONFLICT (label_id, year, month) DO NOTHING;
  END LOOP;
END $$;
