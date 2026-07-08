-- ============================================================
-- SIP Attendance Tracker — Supabase Database Setup
-- 
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com → Your Project → SQL Editor
-- 2. Paste this entire file into the editor
-- 3. Click "Run"
-- That's it! Your database is ready.
-- ============================================================

-- 1. BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  schedule    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id        UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  parent_contact  TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id   UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('present', 'absent')) DEFAULT 'absent',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, batch_id, date)
);

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_students_batch_active ON students(batch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_batches_user_active   ON batches(user_id, is_active);

-- 5. ROW LEVEL SECURITY (keeps data private to each teacher)
ALTER TABLE batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "batches_owner"    ON batches;
DROP POLICY IF EXISTS "students_owner"   ON students;
DROP POLICY IF EXISTS "attendance_owner" ON attendance;

-- Only the logged-in teacher sees their own data
CREATE POLICY "batches_owner" ON batches
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "students_owner" ON students
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid())
  );

CREATE POLICY "attendance_owner" ON attendance
  FOR ALL USING (
    batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid())
  );

-- 6. AUTO-UPDATE updated_at TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batches_updated   ON batches;
DROP TRIGGER IF EXISTS trg_students_updated  ON students;
DROP TRIGGER IF EXISTS trg_attendance_updated ON attendance;

CREATE TRIGGER trg_batches_updated
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_students_updated
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Done! Your SIP Attendance database is ready.
-- ============================================================
