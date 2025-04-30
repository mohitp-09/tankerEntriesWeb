/*
  # Add Driver Status Label Support

  1. Changes
    - Add is_driver_status column to labels table
    - Add driver_status column to tanker_entries table
    - Add total_km column to tanker_entries table
    - Add cash_taken column to tanker_entries table
    - Add notes column to tanker_entries table

  2. Notes
    - is_driver_status defaults to false for backward compatibility
    - driver_status can be 'present' or 'absent'
    - All new columns are nullable for backward compatibility
*/

-- Add is_driver_status to labels table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'labels' AND column_name = 'is_driver_status'
  ) THEN
    ALTER TABLE labels ADD COLUMN is_driver_status boolean DEFAULT false;
  END IF;
END $$;

-- Add new columns to tanker_entries table
DO $$
BEGIN
  -- Add driver_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'driver_status'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN driver_status text CHECK (driver_status IN ('present', 'absent'));
  END IF;

  -- Add total_km column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'total_km'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN total_km numeric NULL;
  END IF;

  -- Add cash_taken column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'cash_taken'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN cash_taken numeric NULL;
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'notes'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN notes text NULL;
  END IF;
END $$;