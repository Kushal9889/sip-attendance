-- ============================================================
-- SIP Attendance Tracker — Database Update v3 (Production)
-- 
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com → Your Project → SQL Editor
-- 2. Click "New Query"
-- 3. Copy and paste this script, then click "Run"
-- ============================================================

-- 1. Add whatsapp_alerted column to attendance table if it doesn't exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS whatsapp_alerted BOOLEAN DEFAULT false;

-- 2. Enforce check constraint for status supporting 'holiday'
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'absent', 'holiday'));

-- 3. Ensure composite unique constraint is active on student/batch/date
-- (If it doesn't exist, this will add it to prevent duplicates)
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_student_id_batch_id_date_key;

ALTER TABLE attendance 
ADD CONSTRAINT attendance_student_id_batch_id_date_key 
UNIQUE (student_id, batch_id, date);
