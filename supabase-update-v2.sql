-- ============================================================
-- SIP Attendance Tracker — Database Update v2
-- 
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com → Your Project → SQL Editor
-- 2. Click "New Query"
-- 3. Copy and paste this script, then click "Run"
-- ============================================================

-- 1. Add arrival_time column to attendance table if it doesn't exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS arrival_time TEXT;

-- 2. Update the status check constraint to allow 'holiday'
-- First, drop the old constraint if it exists (usually named attendance_status_check)
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Add the new constraint supporting 'present', 'absent', and 'holiday'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'absent', 'holiday'));

-- ============================================================
-- Done! Database is updated for Arrival Times & Holidays.
-- ============================================================
