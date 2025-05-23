/*
  # Add Pin Feature to Labels

  1. Changes
    - Add is_pinned column to labels table
    - Default value is false for backward compatibility
    - No data migration needed as the field is optional

  2. Notes
    - Existing labels will have is_pinned set to false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'labels' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE labels ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;
END $$;