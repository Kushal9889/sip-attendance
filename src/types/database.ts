// TypeScript types for Supabase tables
// These mirror the SQL schema exactly

export interface Batch {
  id: string;
  user_id: string;
  name: string;
  schedule: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  batch_id: string;
  name: string;
  enrollment_date: string;
  parent_contact: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Added 'holiday' for class cancel / date swaps
export type AttendanceStatus = 'present' | 'absent' | 'holiday';

export interface Attendance {
  id: string;
  student_id: string;
  batch_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes: string | null;
  arrival_time: string | null; // Added for check-in time logging (v2)
  whatsapp_alerted: boolean | null; // Persisted WhatsApp alert flag (v3)
  created_at: string;
  updated_at: string;
}

// Joined type used in TakeAttendance page
export interface StudentWithAttendance extends Student {
  attendance: Attendance | null;
}

// Summary used in Dashboard
export interface BatchWithSummary extends Batch {
  studentCount: number;
  todayStatus: 'unmarked' | 'partial' | 'complete';
  presentCount: number;
  totalCount: number;
}

// For Supabase typed client
export interface Database {
  public: {
    Tables: {
      batches: { Row: Batch; Insert: Omit<Batch, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Batch> };
      students: { Row: Student; Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Student> };
      attendance: { Row: Attendance; Insert: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Attendance> };
    };
  };
}
