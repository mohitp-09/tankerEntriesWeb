/*
  # Add total_tankers field to tanker_entries table

  1. Changes
    - Add total_tankers column to tanker_entries table
    - Column is nullable to maintain backward compatibility
    - Default value is NULL

  2. Notes
    - Existing entries will have NULL for total_tankers
    - No data migration needed as the field is optional
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tanker_entries' AND column_name = 'total_tankers'
  ) THEN
    ALTER TABLE tanker_entries ADD COLUMN total_tankers integer NULL;
  END IF;
END $$;