import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, getDaysInMonth, getFirstDayOfWeek, getDayNumber, isFutureDate, displayDate } from '../lib/dates';
import type { Batch } from '../types/database';

interface DayStats {
  date: string;
  total: number;
  present: number;
  holiday: number;
  absent: number;
}

interface AttRow {
  date: string;
  status: string;
  batch_id: string;
}

export function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const today = todayIST();
  const [yearMonth, setYearMonth] = useState(() => today.slice(0, 7));

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [dayStats, setDayStats] = useState<Map<string, DayStats>>(new Map());
  const [loading, setLoading] = useState(true);

  // Dynamic modal state for date clicks when All Batches is selected
  const [clickedDate, setClickedDate] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('batches').select('*').eq('user_id', user.id).eq('is_active', true)
      .then(({ data }) => setBatches((data ?? []) as Batch[]));
  }, [user]);

  const loadMonthStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const days = getDaysInMonth(yearMonth);
      const start = days[0];
      const end   = days[days.length - 1];

      const batchIds = batches.map(b => b.id);
      if (batchIds.length === 0) { setDayStats(new Map()); setLoading(false); return; }

      let query = supabase
        .from('attendance').select('date, status, batch_id')
        .gte('date', start).lte('date', end);

      if (selectedBatch !== 'all') {
        query = query.eq('batch_id', selectedBatch);
      } else {
        query = query.in('batch_id', batchIds);
      }

      const { data } = await query;
      const rows = (data ?? []) as AttRow[];
      const map = new Map<string, DayStats>();
      rows.forEach(row => {
        const existing = map.get(row.date) ?? { date: row.date, total: 0, present: 0, holiday: 0, absent: 0 };
        existing.total++;
        if (row.status === 'present') existing.present++;
        else if (row.status === 'holiday') existing.holiday++;
        else if (row.status === 'absent') existing.absent++;
        map.set(row.date, existing);
      });
      setDayStats(map);
    } catch {
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, yearMonth, selectedBatch, batches, showToast]);

  useEffect(() => { loadMonthStats(); }, [loadMonthStats]);

  const prevMonth = () => {
    const [yVal, mVal] = yearMonth.split('-').map(Number);
    const d = new Date(yVal, mVal - 2, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [yVal, mVal] = yearMonth.split('-').map(Number);
    const d = new Date(yVal, mVal, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (next <= today.slice(0, 7)) setYearMonth(next);
  };

  const getDotClass = (date: string) => {
    const stat = dayStats.get(date);
    if (!stat || stat.total === 0) return null;
    
    // Class was holiday/canceled for everyone
    if (stat.holiday === stat.total) return 'dot-blue';
    
    // All present or marked holiday (no absences)
    if (stat.absent === 0 && (stat.present > 0 || stat.holiday > 0)) return 'dot-green';
    
    // All absent (excluding holiday count)
    const activeTotal = stat.total - stat.holiday;
    if (stat.absent === activeTotal && activeTotal > 0) return 'dot-red';
    
    return 'dot-orange';
  };

  const days = getDaysInMonth(yearMonth);
  const firstDow = getFirstDayOfWeek(yearMonth);
  const [y, m] = yearMonth.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const isFutureMonth = yearMonth > today.slice(0, 7);
  const isCurrentMonth = yearMonth === today.slice(0, 7);

  return (
    <Layout title="Calendar">
      <div style={{ marginBottom: '16px' }}>
        <label className="form-label" style={{ marginBottom: '6px' }}>Filter by Batch</label>
        <select className="input" value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} style={{ height: '44px', minHeight: 'unset', padding: '10px 14px' }}>
          <option value="all">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', padding: '0 4px' }}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ fontWeight: 700 }}>← Prev</button>
        <h2 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>{monthLabel}</h2>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth} disabled={isFutureMonth} style={{ fontWeight: 700 }}>Next →</button>
      </div>

      <div className="card" style={{ padding: '16px', border: '1px solid rgba(15,23,42,0.06)' }}>
        <div className="calendar-grid" style={{ marginBottom: '8px' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="calendar-day-header" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-400)' }}>{d}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="calendar-grid">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day empty" />
            ))}
            {days.map(date => {
              const dayNum = getDayNumber(date);
              const isToday = date === today;
              const isFuture = isFutureDate(date);
              const dot = getDotClass(date);
              return (
                <div
                  key={date}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`}
                  onClick={() => {
                    if (isFuture) return;
                    if (selectedBatch !== 'all') {
                      navigate(`/attendance/${selectedBatch}/${date}`);
                    } else {
                      if (batches.length === 1) {
                        navigate(`/attendance/${batches[0].id}/${date}`);
                      } else if (batches.length > 1) {
                        setClickedDate(date);
                        setShowBatchModal(true);
                      }
                    }
                  }}
                  style={{
                    borderRadius: 'var(--r-md)',
                    border: isToday ? '2px solid var(--primary)' : 'none',
                    background: isToday ? 'var(--primary-light)' : 'transparent',
                    aspectRatio: '1',
                    height: 'auto'
                  }}
                >
                  <span className="calendar-day-num" style={{ fontSize: '13px', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--primary)' : 'var(--slate-700)' }}>
                    {dayNum}
                  </span>
                  {dot && <div className={`calendar-dot ${dot}`} style={{ width: '6px', height: '6px', marginTop: '2px' }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--slate-500)', fontWeight: 600, flexWrap: 'wrap' }}>
        {[{ cls: 'dot-green', label: 'All present' }, { cls: 'dot-orange', label: 'Some absent' }, { cls: 'dot-red', label: 'All absent' }, { cls: 'dot-blue', label: 'Holiday' }].map(({ cls, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className={`calendar-dot ${cls}`} style={{ width: 8, height: 8 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {!isCurrentMonth && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setYearMonth(today.slice(0, 7))} style={{ borderRadius: 'var(--r-full)', border: '1px solid var(--slate-200)', background: 'var(--surface)' }}>
            Go to Current Month
          </button>
        </div>
      )}

      {/* Select Batch Modal */}
      <Modal 
        isOpen={showBatchModal} 
        onClose={() => setShowBatchModal(false)} 
        title="Select Class Batch"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '8px', fontWeight: 600 }}>
            Choose which class batch to view or mark attendance for on <strong>{clickedDate ? displayDate(clickedDate) : ''}</strong>:
          </p>
          {batches.map(b => (
            <button
              key={b.id}
              className="btn btn-secondary btn-full"
              style={{ justifyContent: 'flex-start', padding: '14px', textAlign: 'left', fontWeight: 700 }}
              onClick={() => {
                setShowBatchModal(false);
                if (clickedDate) navigate(`/attendance/${b.id}/${clickedDate}`);
              }}
            >
              📚 {b.name}
            </button>
          ))}
          <button 
            className="btn btn-ghost btn-full" 
            style={{ marginTop: '8px' }} 
            onClick={() => setShowBatchModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
