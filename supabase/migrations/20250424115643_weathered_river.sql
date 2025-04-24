/*
  # Initial Schema Setup for Tanker Management App

  1. New Tables
    - `labels`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `name` (text)
      - `color` (text)
      - `user_id` (uuid, foreign key to auth.users)
    
    - `tanker_entries`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `date` (date)
      - `time` (text)
      - `cash_amount` (decimal, nullable)
      - `label_id` (uuid, foreign key to labels)
      - `user_id` (uuid, foreign key to auth.users)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to perform CRUD operations on their own data
*/

-- Create labels table
CREATE TABLE IF NOT EXISTS labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  color text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create tanker_entries table
CREATE TABLE IF NOT EXISTS tanker_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  date date NOT NULL,
  time text NOT NULL,
  cash_amount decimal NULL,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanker_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for labels table
CREATE POLICY "Users can view their own labels"
  ON labels
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own labels"
  ON labels
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels"
  ON labels
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels"
  ON labels
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for tanker_entries table
CREATE POLICY "Users can view their own tanker entries"
  ON tanker_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tanker entries"
  ON tanker_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tanker entries"
  ON tanker_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tanker entries"
  ON tanker_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_labels_user_id ON labels(user_id);
CREATE INDEX idx_tanker_entries_user_id ON tanker_entries(user_id);
CREATE INDEX idx_tanker_entries_label_id ON tanker_entries(label_id);
CREATE INDEX idx_tanker_entries_date ON tanker_entries(date);