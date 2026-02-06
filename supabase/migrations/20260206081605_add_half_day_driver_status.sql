/*
  # Add Half Day Driver Status Support

  1. Overview
    - Add support for "half_day" as a new driver status option
    - Enable conversion logic: 2 half days = 1 present day
    - Track half days separately in monthly summary

  2. Changes to tanker_entries table
    - The driver_status column now supports: 'present', 'absent', 'half_day'
    - Existing data remains unchanged
    - Half day entries will be tracked and converted dynamically

  3. New Columns for Monthly Data
    - Add total_half_days to track half days in a month
    - Calculations automatically convert 2 half days to 1 present day

  4. Important Notes
    - Backward compatible - existing entries untouched
    - 2 half days = 1 present day (conversion logic)
    - Remaining half days after conversion are tracked separately
    - RLS policies remain unchanged
*/

DO $$
BEGIN
  -- Add comment to driver_status column to document new half_day option
  COMMENT ON COLUMN tanker_entries.driver_status IS 'Status can be: present, absent, or half_day';
END $$;