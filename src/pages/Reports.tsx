import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getMonthKey, getDaysInMonth, shortDate } from '../lib/dates';
import type { Batch, Student } from '../types/database';

interface StudentReport {
  student: Student;
  presentDays: number;
  totalDays: number;
  holidayDays: number;
  percentage: number;
  details: { date: string; status: string; arrivalTime: string | null }[];
}

interface BatchReport {
  batch: Batch;
  students: StudentReport[];
  avgPercentage: number;
}

interface AttRow {
  student_id: string;
  batch_id: string;
  date: string;
  status: string;
  arrival_time: string | null;
}

export function Reports() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [monthOffset, setMonthOffset] = useState(0);
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [loading, setLoading] = useState(true);

  const monthKey = getMonthKey(monthOffset);
  const [y, m] = monthKey.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(monthKey);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = days[0];
      const end   = days[days.length - 1];

      const { data: batches } = await supabase
        .from('batches').select('*').eq('user_id', user.id).eq('is_active', true).order('name');

      const bList = (batches ?? []) as Batch[];
      if (!bList.length) { setReports([]); setLoading(false); return; }

      const batchIds = bList.map(b => b.id);

      // Batch query 1: Fetch all students (both active and inactive) for all user batches in a single query
      const { data: students } = await supabase
        .from('students').select('*').in('batch_id', batchIds).order('name');
      const allStudentsList = (students ?? []) as Student[];

      // Batch query 2: Fetch all attendance logs for the month for all user batches in a single query
      const { data: att } = await supabase
        .from('attendance').select('student_id, batch_id, date, status, arrival_time')
        .in('batch_id', batchIds).gte('date', start).lte('date', end);
      const allAttList = (att ?? []) as AttRow[];

      // Index in-memory for constant-time mapping
      const attendanceByBatch = allAttList.reduce((acc, a) => {
        if (!acc[a.batch_id]) acc[a.batch_id] = [];
        acc[a.batch_id].push(a);
        return acc;
      }, {} as Record<string, AttRow[]>);

      const studentsByBatch = allStudentsList.reduce((acc, s) => {
        if (!acc[s.batch_id]) acc[s.batch_id] = [];
        acc[s.batch_id].push(s);
        return acc;
      }, {} as Record<string, Student[]>);

      const batchReports = bList.map((batch) => {
        const sListAll = studentsByBatch[batch.id] || [];
        const attList = attendanceByBatch[batch.id] || [];

        // Track which students actually have attendance logs in the selected month
        const loggedStudentIds = new Set(attList.map(a => a.student_id));

        // Filter: Keep student if they are active OR if they have historical records this month
        const sList = sListAll.filter(s => s.is_active || loggedStudentIds.has(s.id));

        if (!sList.length) return { batch, students: [], avgPercentage: 0 };

        const presentMap = new Map<string, number>();
        const holidayMap = new Map<string, number>();
        const markedMap  = new Map<string, number>();
        const detailMap  = new Map<string, StudentReport['details']>();

        attList.forEach(a => {
          if (a.status === 'present') presentMap.set(a.student_id, (presentMap.get(a.student_id) ?? 0) + 1);
          if (a.status === 'holiday') holidayMap.set(a.student_id, (holidayMap.get(a.student_id) ?? 0) + 1);
          markedMap.set(a.student_id, (markedMap.get(a.student_id) ?? 0) + 1);

          const list = detailMap.get(a.student_id) ?? [];
          list.push({ date: a.date, status: a.status, arrivalTime: a.arrival_time });
          detailMap.set(a.student_id, list);
        });

        const studentReports: StudentReport[] = sList.map(s => {
          const present = presentMap.get(s.id) ?? 0;
          const holiday = holidayMap.get(s.id) ?? 0;
          const total   = markedMap.get(s.id) ?? 0;
          
          // Calculate percentage excluding holiday days (division by zero guard)
          const denominator = total - holiday;
          const pct     = denominator > 0 ? Math.round((present / denominator) * 100) : 0;
          
          // Sort details by date descending
          const details = (detailMap.get(s.id) ?? []).sort((a, b) => b.date.localeCompare(a.date));

          return { 
            student: s, 
            presentDays: present, 
            holidayDays: holiday,
            totalDays: total, 
            percentage: pct,
            details 
          };
        });

        const avgPct = studentReports.length > 0
          ? Math.round(studentReports.reduce((s, r) => s + r.percentage, 0) / studentReports.length)
          : 0;

        return { batch, students: studentReports, avgPercentage: avgPct };
      });

      setReports(batchReports.filter(r => r.students.length > 0));
    } catch {
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, monthKey, showToast]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const getPctColor = (pct: number) => {
    if (pct >= 75) return 'var(--present)';
    if (pct >= 50) return 'var(--unmarked)';
    return 'var(--absent)';
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    try {
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const dispH = h % 12 || 12;
      return `${dispH}:${mStr} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // CSV Exporter (Group B Feature)
  const exportCSV = (batchName: string, students: StudentReport[]) => {
    let csv = '\uFEFF'; // UTF-8 BOM for Excel CJK support
    csv += 'Student Name,Attendance Rate,Classes Marked,Present Days,Holiday Days\n';
    students.forEach(r => {
      csv += `"${r.student.name.replace(/"/g, '""')}",${r.percentage}%,${r.totalDays},${r.presentDays},${r.holidayDays}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${batchName.replace(/\s+/g, '_')}_Report_${monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Spreadsheet exported successfully!');
  };

  return (
    <Layout title="Reports">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonthOffset(o => o - 1)}>← Prev</button>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{monthLabel}</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0}>Next →</button>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ height: '200px' }}><div className="spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No data for {monthLabel}</h3>
          <p>Start marking attendance to see monthly reports here</p>
        </div>
      ) : (
        <div className="grid-responsive">
          {reports.map(({ batch, students, avgPercentage }) => (
            <div key={batch.id} className="card">
              {/* Batch Card Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '2px', fontSize: '16px' }}>{batch.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 600 }}>{students.length} students</span>
                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => exportCSV(batch.name, students)}
                      style={{ padding: '2px 8px', minHeight: 'unset', height: '22px', fontSize: '10px', borderRadius: '4px', border: '1px solid var(--slate-200)', background: 'var(--slate-50)', fontWeight: 700 }}
                    >
                      📥 Export CSV
                    </button>
                  </div>
                </div>
                <div style={{
                  background: avgPercentage >= 75 ? 'var(--present-bg)' : avgPercentage >= 50 ? 'var(--unmarked-bg)' : 'var(--absent-bg)',
                  color: getPctColor(avgPercentage),
                  borderRadius: '100px', padding: '6px 14px', fontWeight: 700, fontSize: 'var(--text-lg)',
                }}>
                  {avgPercentage}%
                </div>
              </div>

              {/* Student Rows */}
              {students.map((r, idx) => (
                <div key={r.student.id} style={{
                  padding: '14px 16px',
                  borderBottom: idx < students.length - 1 ? '1px solid var(--slate-100)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--slate-700)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {r.student.name}
                      {/* Attendance Streak Badge (Perfect Month!) */}
                      {r.percentage === 100 && r.totalDays > 0 && (
                        <span title="Perfect Attendance! 🔥" style={{ cursor: 'pointer' }}>🔥</span>
                      )}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 600 }}>
                        {r.presentDays} present {r.holidayDays > 0 && `(excl. ${r.holidayDays} holidays)`}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: getPctColor(r.percentage), minWidth: 40, textAlign: 'right' }}>
                        {r.percentage}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress fill */}
                  <div className="progress-bar" style={{ height: '6px', marginBottom: '10px' }}>
                    <div className="progress-fill" style={{
                      width: `${r.percentage}%`,
                      background: r.percentage >= 75
                        ? 'linear-gradient(90deg, var(--present), #22c55e)'
                        : r.percentage >= 50
                        ? 'linear-gradient(90deg, var(--unmarked), #f59e0b)'
                        : 'linear-gradient(90deg, var(--absent), #ef4444)',
                    }} />
                  </div>

                  {/* Arrival history log (v2 Detail feature) */}
                  {r.details.length > 0 && (
                    <div style={{ background: 'var(--slate-50)', padding: '8px 12px', borderRadius: 'var(--r-sm)', fontSize: '11px', border: '1px solid rgba(15,23,42,0.02)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--slate-400)', display: 'block', marginBottom: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log Summary:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {r.details.slice(0, 4).map(d => (
                          <span key={d.date} style={{ 
                            background: d.status === 'present' ? 'var(--present-bg)' : d.status === 'holiday' ? 'var(--holiday-bg)' : 'var(--absent-bg)',
                            color: d.status === 'present' ? 'var(--present)' : d.status === 'holiday' ? 'var(--holiday)' : 'var(--absent)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            {shortDate(d.date)}
                            {d.status === 'present' && d.arrivalTime && ` (${formatTime(d.arrivalTime)})`}
                            {d.status === 'holiday' && ' (Holiday)'}
                            {d.status === 'absent' && ' (Absent)'}
                          </span>
                        ))}
                        {r.details.length > 4 && <span style={{ color: 'var(--slate-400)', alignSelf: 'center', fontSize: '10px', fontWeight: 600 }}>+{r.details.length - 4} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--slate-400)', padding: '16px', fontWeight: 600 }}>
        {monthLabel} · {days.length} calendar days
      </p>
    </Layout>
  );
}
