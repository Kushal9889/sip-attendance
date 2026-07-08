import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { displayDate, isFutureDate } from '../lib/dates';
import type { Student, Attendance } from '../types/database';

interface StudentRow extends Student {
  attendance: Attendance | null;
}

type ModeStatus = 'present' | 'absent' | 'holiday';

export function TakeAttendance() {
  const { batchId, date } = useParams<{ batchId: string; date: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [batchName, setBatchName] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveIndicator, setSaveIndicator] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'absent' | 'holiday'>('all');

  // Quick Horizontal Date Bar: 7 days centered around selected date
  const [recentDates, setRecentDates] = useState<string[]>([]);

  // Notified parents map (Group B feature)
  const [notifiedMap, setNotifiedMap] = useState<Record<string, boolean>>({});

  const isFuture = date ? isFutureDate(date) : false;

  useEffect(() => {
    // Re-center the 7-day scroll bar around the currently selected date
    // Shows 3 days before and 3 days after the active date
    const anchor = date ? new Date(date + 'T00:00:00') : new Date();
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dates = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      dates.push(formatter.format(d));
    }
    setRecentDates(dates);
  }, [date]);

  // Load parent notification states
  useEffect(() => {
    if (!batchId || !date) return;
    try {
      const saved = localStorage.getItem(`notified_${batchId}_${date}`);
      if (saved) setNotifiedMap(JSON.parse(saved));
      else setNotifiedMap({});
    } catch {}
  }, [batchId, date]);

  const logNotification = async (studentId: string) => {
    const updated = { ...notifiedMap, [studentId]: true };
    setNotifiedMap(updated);
    try {
      localStorage.setItem(`notified_${batchId}_${date}`, JSON.stringify(updated));
    } catch {}

    // Persist alerted status directly to database row (upsert)
    try {
      const existingRow = rows.find(r => r.id === studentId)?.attendance;
      const { error } = await supabase.from('attendance').upsert(
        { 
          student_id: studentId, 
          batch_id: batchId!, 
          date: date!, 
          status: existingRow?.status || 'absent', 
          arrival_time: existingRow?.arrival_time || null,
          whatsapp_alerted: true
        } as Record<string, unknown>,
        { onConflict: 'student_id,batch_id,date' }
      );
      if (error) throw error;
      showSaved('Alert status saved ✓');
    } catch {
      showToast('Could not save alert status to cloud', 'error');
    }
  };

  const showSaved = (msg = 'Saved to cloud ✓') => {
    setSaveIndicator(msg);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveIndicator(''), 2500);
  };

  const loadData = useCallback(async () => {
    if (!batchId || !date) return;
    setLoading(true);
    try {
      const { data: batch } = await supabase.from('batches').select('name').eq('id', batchId).single();
      setBatchName((batch as { name: string } | null)?.name ?? '');

      const { data: students } = await supabase
        .from('students').select('*').eq('batch_id', batchId).eq('is_active', true).order('name');

      const studentList = (students ?? []) as Student[];
      if (!studentList.length) { setRows([]); setLoading(false); return; }

      // Get existing attendance
      const { data: existing } = await supabase
        .from('attendance').select('*').eq('batch_id', batchId).eq('date', date);
      const existingList = (existing ?? []) as Attendance[];
      const attMap = new Map(existingList.map(a => [a.student_id, a]));

      // Auto-init: create absent rows for students without attendance (if not in future)
      const missing = studentList.filter(s => !attMap.has(s.id));
      if (missing.length > 0 && !isFutureDate(date)) {
        const inserts = missing.map(s => ({
          student_id: s.id,
          batch_id: batchId,
          date,
          status: 'absent',
        }));
        await supabase.from('attendance')
          .upsert(inserts as Record<string, unknown>[], { onConflict: 'student_id,batch_id,date', ignoreDuplicates: true });
      }

      // Fetch final state
      const { data: allAtt } = await supabase
        .from('attendance').select('*').eq('batch_id', batchId).eq('date', date);
      const finalList = (allAtt ?? []) as Attendance[];
      const finalMap = new Map(finalList.map(a => [a.student_id, a]));

      // Populate notifiedMap from database records
      const dbNotified: Record<string, boolean> = {};
      finalList.forEach(a => {
        if (a.whatsapp_alerted) dbNotified[a.student_id] = true;
      });
      setNotifiedMap(dbNotified);

      setRows(studentList.map(s => ({ ...s, attendance: finalMap.get(s.id) ?? null })));
    } catch {
      showToast('Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, date, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const getCurrentTimeIST = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(now);
  };

  const markStatus = async (studentId: string, status: ModeStatus, customTime?: string | null) => {
    if (isFuture) {
      showToast('Cannot mark attendance for future dates', 'error');
      return;
    }

    // Keep rollback backup
    const rollbackRows = [...rows];

    // Pre-calculate final time
    let finalTime: string | null = null;
    if (customTime !== undefined) {
      finalTime = customTime;
    } else {
      const currentRow = rows.find(r => r.id === studentId);
      const existingTime = currentRow?.attendance?.arrival_time;
      if (status === 'present') {
        finalTime = existingTime || getCurrentTimeIST();
      } else {
        finalTime = null;
      }
    }

    // Optimistically update UI immediately
    setRows(prev => prev.map(r =>
      r.id === studentId 
        ? { 
            ...r, 
            attendance: r.attendance 
              ? { ...r.attendance, status: status as 'present' | 'absent' | 'holiday', arrival_time: finalTime, whatsapp_alerted: status === 'present' ? false : (r.attendance.whatsapp_alerted || false) } 
              : { id: '', student_id: studentId, batch_id: batchId!, date: date!, status: status as 'present' | 'absent' | 'holiday', notes: null, arrival_time: finalTime, whatsapp_alerted: false, created_at: '', updated_at: '' } 
          } 
        : r
    ));

    // Attempt haptic vibrate feedback
    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch {}

    setSavingId(studentId);
    try {
      const existingRow = rows.find(r => r.id === studentId)?.attendance;
      const { error } = await supabase.from('attendance').upsert(
        { 
          student_id: studentId, 
          batch_id: batchId!, 
          date: date!, 
          status,
          arrival_time: finalTime,
          whatsapp_alerted: status === 'present' ? false : (existingRow?.whatsapp_alerted || false)
        } as Record<string, unknown>,
        { onConflict: 'student_id,batch_id,date' }
      );
      if (error) throw error;
      showSaved();
    } catch {
      // Rollback
      setRows(rollbackRows);
      showToast('Could not save status. Connection error.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const markAll = async (status: ModeStatus) => {
    if (isFuture) return;
    
    const rollbackRows = [...rows];
    const defaultTime = status === 'present' ? getCurrentTimeIST() : null;

    // Optimistically update all
    setRows(prev => prev.map(r => ({ 
      ...r, 
      attendance: r.attendance 
        ? { ...r.attendance, status: status as 'present' | 'absent' | 'holiday', arrival_time: defaultTime, whatsapp_alerted: false } 
        : { id: '', student_id: r.id, batch_id: batchId!, date: date!, status: status as 'present' | 'absent' | 'holiday', notes: null, arrival_time: defaultTime, whatsapp_alerted: false, created_at: '', updated_at: '' } 
    })));

    setLoading(true);
    const updates = rows.map(r => ({
      student_id: r.id, 
      batch_id: batchId!, 
      date: date!, 
      status,
      arrival_time: defaultTime,
      whatsapp_alerted: false // Reset alert status on bulk marking
    }));
    try {
      const { error } = await supabase.from('attendance')
        .upsert(updates as Record<string, unknown>[], { onConflict: 'student_id,batch_id,date' });
      if (error) throw error;
      showSaved(`All marked ${status} ✓`);
    } catch {
      // Rollback
      setRows(rollbackRows);
      showToast('Could not update all. Connection error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    navigate(`/attendance/${batchId}/${newDate}`);
  };

  // WhatsApp Alert Link builder
  const getWhatsAppLink = (studentName: string, phone: string | null) => {
    if (!phone) return '';
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    const cleanPhone = formattedPhone.startsWith('91') && formattedPhone.length === 12 
      ? formattedPhone 
      : formattedPhone.length === 10 
      ? `91${formattedPhone}` 
      : formattedPhone;
      
    const text = encodeURIComponent(
      `Hello! This is a reminder from *SIP Abacus*. Your child *${studentName}* was marked ABSENT for our class on *${displayDate(date!)}*. Hope everything is fine!`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  // WhatsApp Class Summary link
  const getSummaryWhatsAppText = () => {
    const presentList = rows.filter(r => r.attendance?.status === 'present');
    const absentList = rows.filter(r => r.attendance?.status === 'absent');
    const holidayList = rows.filter(r => r.attendance?.status === 'holiday');
    
    let text = `*SIP Abacus Attendance Summary*\n`;
    text += `*Batch:* ${batchName}\n`;
    text += `*Date:* ${displayDate(date!)}\n`;
    text += `---------------------------\n`;
    text += `✅ *Present (${presentList.length}):*\n`;
    presentList.forEach(r => {
      text += `  • ${r.name} (${r.attendance?.arrival_time ? formatTimeDisplay(r.attendance.arrival_time) : 'No time'})\n`;
    });
    
    if (absentList.length > 0) {
      text += `\n❌ *Absent (${absentList.length}):*\n`;
      absentList.forEach(r => { text += `  • ${r.name}\n`; });
    }
    
    if (holidayList.length > 0) {
      text += `\n🏖️ *Holiday (${holidayList.length}):*\n`;
      holidayList.forEach(r => { text += `  • ${r.name}\n`; });
    }
    
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const formatTimeDisplay = (timeStr: string | null) => {
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

  const present = rows.filter(r => r.attendance?.status === 'present').length;
  const absent  = rows.filter(r => r.attendance?.status === 'absent').length;
  const holiday = rows.filter(r => r.attendance?.status === 'holiday').length;
  const total   = rows.length;
  const pct     = total > 0 ? Math.round((present / (total - holiday || 1)) * 100) : 0;

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Search & Filter execution
  const filteredRows = rows.filter(row => {
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
    const status = row.attendance?.status ?? 'absent';
    const matchesFilter = activeFilter === 'all' || status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout title={batchName || 'Attendance'} backTo="/">
      {/* Premium Horizontal Date Slider */}
      <div className="section-label" style={{ marginBottom: '6px' }}>Select Class Date</div>
      <div className="date-scroll-container">
        {recentDates.map(dStr => {
          const dateObj = new Date(dStr);
          const active = dStr === date;
          const labelDay = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const labelNum = dateObj.getDate();
          return (
            <div 
              key={dStr} 
              className={`date-scroll-pill ${active ? 'active' : ''}`}
              onClick={() => handleDateChange(dStr)}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, color: active ? 'white' : 'var(--slate-400)', textTransform: 'uppercase' }}>
                {labelDay}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: active ? 'white' : 'var(--slate-800)', marginTop: '2px' }}>
                {labelNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Date Picker Header */}
      <div className="card" style={{ padding: '14px', marginBottom: '18px', background: 'var(--slate-50)', border: '1.5px solid var(--slate-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 800, textTransform: 'uppercase' }}>Selected Date</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-800)', marginTop: '2px' }}>
              {date ? displayDate(date) : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {saveIndicator && (
              <span style={{ fontSize: '12px', color: 'var(--present)', fontWeight: 700 }}>{saveIndicator}</span>
            )}
            <input 
              type="date" 
              className="time-picker-input" 
              value={date} 
              onChange={e => handleDateChange(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 8px', height: '36px' }}
            />
          </div>
        </div>
      </div>

      {isFuture && (
        <div className="badge badge-unmarked" style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px', fontSize: '13px', borderRadius: 'var(--r-md)', marginBottom: '14px', borderStyle: 'dashed' }}>
          ⚠️ Future Class: Attendance logging is disabled.
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ height: '240px' }}>
          <div className="spinner" /><span>Loading students…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ background: 'var(--slate-50)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--slate-300)' }}>
          <div className="empty-icon">👥</div>
          <h3>No students enrolled</h3>
          <p style={{ color: 'var(--slate-400)' }}>Add students first to start logging attendance.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/batch/${batchId}`)} style={{ marginTop: '10px' }}>
            Go to Students
          </button>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="stat-row" style={{ marginBottom: '18px', gap: '10px' }}>
            <div className="stat-pill" style={{ flex: 1, padding: '10px' }}>
              <div className="stat-value" style={{ color: 'var(--present)', fontSize: '20px' }}>{present}</div>
              <div className="stat-label">Present</div>
            </div>
            <div className="stat-pill" style={{ flex: 1, padding: '10px' }}>
              <div className="stat-value" style={{ color: 'var(--absent)', fontSize: '20px' }}>{absent}</div>
              <div className="stat-label">Absent</div>
            </div>
            {holiday > 0 ? (
              <div className="stat-pill" style={{ flex: 1, padding: '10px' }}>
                <div className="stat-value" style={{ color: 'var(--holiday)', fontSize: '20px' }}>{holiday}</div>
                <div className="stat-label">Holiday</div>
              </div>
            ) : (
              <div className="stat-pill" style={{ flex: 1, padding: '10px' }}>
                <div className="stat-value" style={{ fontSize: '20px' }}>{pct}%</div>
                <div className="stat-label">Attended</div>
              </div>
            )}
          </div>

          <div className="progress-bar" style={{ marginBottom: '18px', height: '6px' }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {/* Bulk Action Controls */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
            <button className="btn btn-sm btn-full" onClick={() => markAll('present')} disabled={isFuture}
              style={{ background: 'var(--present-bg)', color: 'var(--present)', border: '1.5px solid var(--present-border)', fontWeight: 700 }}>
              ✅ All Present
            </button>
            <button className="btn btn-sm btn-full" onClick={() => markAll('absent')} disabled={isFuture}
              style={{ background: 'var(--absent-bg)', color: 'var(--absent)', border: '1.5px solid var(--absent-border)', fontWeight: 700 }}>
              ❌ All Absent
            </button>
            <button className="btn btn-sm btn-full" onClick={() => markAll('holiday')} disabled={isFuture}
              style={{ background: 'var(--holiday-bg)', color: 'var(--holiday)', border: '1.5px solid var(--holiday-border)', fontWeight: 700 }}>
              🏖️ Holiday
            </button>
          </div>

          {/* Search & Custom filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                className="input" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="🔍 Search student..." 
                style={{ minHeight: '38px', height: '38px', padding: '8px 30px 8px 12px', fontSize: '13px', width: '100%' }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: 'var(--slate-400)',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <select 
              className="input" 
              value={activeFilter} 
              onChange={e => setActiveFilter(e.target.value as typeof activeFilter)}
              style={{ minHeight: '38px', height: '38px', padding: '0 24px 0 10px', fontSize: '13px', width: '110px' }}
            >
              <option value="all">All ({rows.length})</option>
              <option value="present">Present ({present})</option>
              <option value="absent">Absent ({absent})</option>
              <option value="holiday">Holiday ({holiday})</option>
            </select>
          </div>

          {/* Student list */}
          <div className="grid-responsive">
            {filteredRows.map((row, idx) => {
              const status = row.attendance?.status ?? 'absent';
              const arrivalTime = row.attendance?.arrival_time ?? '';
              const hasBeenNotified = notifiedMap[row.id] === true;
              
              return (
                <div key={row.id} className="card" style={{ borderLeft: `6px solid ${status === 'present' ? 'var(--present)' : status === 'holiday' ? 'var(--holiday)' : 'var(--absent)'}` }}>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div className="avatar" style={{
                        background: `linear-gradient(135deg, hsl(${(idx * 79) % 360}, 65%, 55%), hsl(${(idx * 79 + 35) % 360}, 65%, 45%))`
                      }}>
                        {getInitials(row.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--slate-800)' }} className="truncate">
                          {row.name}
                        </div>
                        {row.parent_contact && (
                          <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📱</span> <span>{row.parent_contact}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* WhatsApp Notification trigger for absent students */}
                      {status === 'absent' && row.parent_contact && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {hasBeenNotified && (
                            <span style={{ fontSize: '11px', color: 'var(--present)', fontWeight: 700 }}>✓ Alerted</span>
                          )}
                          <a 
                            href={getWhatsAppLink(row.name, row.parent_contact)}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            onClick={() => logNotification(row.id)}
                            style={{ minHeight: 'unset', height: '32px', padding: '4px 10px', background: hasBeenNotified ? 'var(--slate-100)' : '#e8fbf0', color: hasBeenNotified ? 'var(--slate-500)' : '#128c7e', borderColor: hasBeenNotified ? 'var(--slate-200)' : '#a3e9c9', display: 'inline-flex', gap: '4px' }}
                          >
                            💬 {hasBeenNotified ? 'Re-alert' : 'Send Alert'}
                          </a>
                        </div>
                      )}
                      
                      {savingId === row.id && (
                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      )}
                    </div>

                    {/* Touch Toggle Buttons */}
                    <div className="status-pill-group">
                      <button 
                        className={`status-btn ${status === 'present' ? 'present-active' : ''}`}
                        onClick={() => markStatus(row.id, 'present')}
                        disabled={savingId === row.id || isFuture}
                      >
                        Present
                      </button>
                      <button 
                        className={`status-btn ${status === 'absent' ? 'absent-active' : ''}`}
                        onClick={() => markStatus(row.id, 'absent')}
                        disabled={savingId === row.id || isFuture}
                      >
                        Absent
                      </button>
                      <button 
                        className={`status-btn ${status === 'holiday' ? 'holiday-active' : ''}`}
                        onClick={() => markStatus(row.id, 'holiday')}
                        disabled={savingId === row.id || isFuture}
                      >
                        Holiday
                      </button>
                    </div>

                    {/* Arrival Time Selector (Only show if present) */}
                    {status === 'present' && (
                      <div className="time-log-row">
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-600)' }}>
                          🕒 Arrival Time:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Quick time template triggers */}
                          <button 
                            className="time-btn-pill"
                            onClick={() => markStatus(row.id, 'present', '17:30')}
                            disabled={savingId === row.id || isFuture}
                          >
                            5:30
                          </button>
                          <button 
                            className="time-btn-pill"
                            onClick={() => markStatus(row.id, 'present', '17:45')}
                            disabled={savingId === row.id || isFuture}
                          >
                            5:45
                          </button>
                          <input 
                            type="time" 
                            className="time-picker-input"
                            value={arrivalTime || '17:30'}
                            onChange={e => markStatus(row.id, 'present', e.target.value)}
                            disabled={savingId === row.id || isFuture}
                            style={{ height: '28px', padding: '2px 6px', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Share Class Summary to Center Manager (WhatsApp) */}
          <div style={{ marginTop: '24px' }}>
            <a 
              href={getSummaryWhatsAppText()}
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary btn-full"
              style={{ background: '#128c7e', boxShadow: '0 4px 12px rgba(18,140,126,0.3)', minHeight: '48px' }}
            >
              📲 Share Class Summary on WhatsApp
            </a>
          </div>
        </>
      )}
    </Layout>
  );
}
