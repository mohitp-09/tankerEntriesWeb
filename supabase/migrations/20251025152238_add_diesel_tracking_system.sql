/*
  # Add Diesel Tracking System for Driver Labels

  1. Changes to Labels Table
    - Add `diesel_average` (numeric) - stores the vehicle's fuel efficiency (km/l)
    - Add `current_range` (numeric) - stores the current remaining range (km)
    - These fields are nullable and only used for driver labels

  2. Changes to Tanker Entries Table
    - Add `diesel_added` (numeric) - stores diesel quantity added on that day (liters)
    - This field is nullable and only used for driver status entries

  3. Notes
    - All new columns have default value 0
    - Diesel average and current range are per-label (vehicle)
    - Diesel added is per entry (daily)
    - Current range will be calculated dynamically based on diesel added and KM driven
*/

-- Add diesel tracking fields to labels table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'labels' AND column_name = 'diesel_average'
  ) THEN
    ALTER TABLE labels ADD COLUMN diesel_average numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'labels' AND column_name = 'current_range'
  ) THEN
    ALTER TABLE labels ADD COLUMN current_range numeric DEFAULT 0;
  END IF;
END $$;

-- Add diesel_added field to tanker_entries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'diesel_added'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN diesel_added numeric DEFAULT 0;
  END IF;
END $$;