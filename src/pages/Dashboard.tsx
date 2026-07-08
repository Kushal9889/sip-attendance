import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, displayDate } from '../lib/dates';
import { ProgressRing } from '../components/ProgressRing';
import type { Batch } from '../types/database';

interface BatchWithStats extends Batch {
  studentCount: number;
  presentCount: number;
  totalMarked: number;
  attendancePct: number;
  status: 'unmarked' | 'partial' | 'done' | 'no-students';
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const today = todayIST();

  const [batches, setBatches] = useState<BatchWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);

  const [batchName, setBatchName] = useState('');
  const [batchSchedule, setBatchSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: batchData, error: batchErr } = await supabase
        .from('batches')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (batchErr) throw batchErr;
      const bList = (batchData ?? []) as Batch[];
      if (!bList.length) { setBatches([]); setLoading(false); return; }

      const batchIds = bList.map(b => b.id);

      // Batch query 1: Fetch all active students for all batches in a single query
      const { data: studentsData, error: studentsErr } = await supabase
        .from('students')
        .select('id, batch_id')
        .in('batch_id', batchIds)
        .eq('is_active', true);
      if (studentsErr) throw studentsErr;

      // Batch query 2: Fetch all attendance logs for today for all batches in a single query
      const { data: attendanceData, error: attendanceErr } = await supabase
        .from('attendance')
        .select('status, batch_id, student_id')
        .in('batch_id', batchIds)
        .eq('date', today);
      if (attendanceErr) throw attendanceErr;

      // In-memory indexing for constant-time lookups
      const studentsCountByBatch = (studentsData ?? []).reduce((acc, s) => {
        acc[s.batch_id] = (acc[s.batch_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const attendanceByBatch = (attendanceData ?? []).reduce((acc, a) => {
        if (!acc[a.batch_id]) acc[a.batch_id] = [];
        acc[a.batch_id].push(a);
        return acc;
      }, {} as Record<string, typeof attendanceData>);

      const enriched = bList.map((batch) => {
        const total = studentsCountByBatch[batch.id] || 0;
        const rows = attendanceByBatch[batch.id] || [];
        const marked = rows.length;
        const present = rows.filter(a => a.status === 'present').length;
        const holiday = rows.filter(a => a.status === 'holiday').length;

        // Attendance rate excluding holidays
        const denominator = total - holiday;
        const attendancePct = denominator > 0 ? Math.round((present / denominator) * 100) : 0;

        let status: BatchWithStats['status'] = 'unmarked';
        if (total === 0) status = 'no-students';
        else if (marked >= total && total > 0) status = 'done';
        else if (marked > 0) status = 'partial';
        else status = 'unmarked';

        return { 
          ...batch, 
          studentCount: total, 
          presentCount: present, 
          totalMarked: marked, 
          attendancePct, 
          status 
        };
      });

      setBatches(enriched);
    } catch {
      showToast('Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, today, showToast]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const openAddModal = (batch?: Batch) => {
    if (batch) {
      setEditBatch(batch);
      setBatchName(batch.name);
      setBatchSchedule(batch.schedule ?? '');
    } else {
      setEditBatch(null);
      setBatchName('');
      setBatchSchedule('');
    }
    setShowAddModal(true);
  };

  const saveBatch = async () => {
    if (!batchName.trim() || !user) return;
    setSaving(true);
    try {
      if (editBatch) {
        const { error } = await supabase.from('batches').update({
          name: batchName.trim(),
          schedule: batchSchedule.trim() || null,
        }).eq('id', editBatch.id);
        if (error) throw error;
        showToast('Batch updated!');
      } else {
        const { error } = await supabase.from('batches').insert({
          name: batchName.trim(),
          schedule: batchSchedule.trim() || null,
          user_id: user.id,
          is_active: true,
        } as Record<string, unknown>);
        if (error) throw error;
        showToast('New batch created!');
      }
      setShowAddModal(false);
      loadBatches();
    } catch {
      showToast('Could not save batch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteBatch = async (batch: Batch) => {
    if (!confirm(`Archive "${batch.name}"? Records will be kept.`)) return;
    const { error } = await supabase.from('batches').update({ is_active: false } as Record<string, unknown>).eq('id', batch.id);
    if (error) { showToast('Could not archive', 'error'); return; }
    showToast(`"${batch.name}" archived`);
    loadBatches();
  };

  const statusInfo = (b: BatchWithStats) => {
    if (b.status === 'no-students') return { label: 'No students', cls: 'badge-gray' };
    if (b.status === 'done') return { label: 'Marked ✓', cls: 'badge-present' };
    if (b.status === 'partial') return { label: 'In Progress', cls: 'badge-unmarked' };
    return { label: 'Not Marked', cls: 'badge-unmarked' };
  };

  return (
    <Layout title="">
      {/* Brand Header */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '20px' }}>🔴</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-title)' }}>
                SIP Abacus Manager
              </span>
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '10px', 
                color: 'var(--present)', 
                background: 'var(--present-bg)', 
                padding: '2px 8px', 
                borderRadius: '100px', 
                fontWeight: 700,
                border: '1px solid var(--present-border)',
                marginLeft: '8px'
              }}>
                <span className="sync-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--present)' }} />
                Cloud Synced
              </span>
            </div>
            <h1 style={{ fontSize: '24px', letterSpacing: '-0.02em' }}>Good {getGreeting()} 👋</h1>
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px', minHeight: 'unset', width: '38px', height: '38px', borderRadius: '50%' }} onClick={() => setShowMenuModal(true)}>
            ⚙️
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--slate-500)', fontWeight: 600 }}>{displayDate(today)}</p>
      </div>

      {/* Analytics stats row */}
      {!loading && batches.length > 0 && (
        <div className="stat-row" style={{ marginBottom: '24px', gap: '12px' }}>
          <div className="stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '20px' }}>📚</div>
            <div>
              <div className="stat-value" style={{ fontSize: '20px' }}>{batches.length}</div>
              <div className="stat-label" style={{ marginTop: '2px' }}>Total Batches</div>
            </div>
          </div>
          <div className="stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '20px' }}>👥</div>
            <div>
              <div className="stat-value" style={{ fontSize: '20px' }}>{batches.reduce((s, b) => s + b.studentCount, 0)}</div>
              <div className="stat-label" style={{ marginTop: '2px' }}>Students Enrolled</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ height: '240px' }}>
          <div className="spinner" /><span>Loading your class data…</span>
        </div>
      ) : batches.length === 0 ? (
        <div className="empty-state" style={{ background: 'var(--slate-50)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--slate-300)' }}>
          <div className="empty-icon">🎒</div>
          <h3 style={{ fontSize: '18px' }}>No Batches Scheduled</h3>
          <p style={{ color: 'var(--slate-400)' }}>Create your first Saturday or weekday class batch to get started.</p>
          <button className="btn btn-primary" onClick={() => openAddModal()} style={{ marginTop: '12px' }}>
            ➕ Create New Batch
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div className="section-label" style={{ margin: 0, fontSize: '11px', letterSpacing: '0.12em' }}>Today's Batches</div>
            <button className="btn btn-secondary btn-sm" onClick={() => openAddModal()} style={{ minHeight: 'unset', padding: '6px 14px', borderRadius: 'var(--r-full)' }}>
              ➕ Add New Batch
            </button>
          </div>
          
          <div className="grid-responsive">
            {batches.map(batch => {
              const info = statusInfo(batch);
              return (
                <div key={batch.id} className="card" style={{ borderLeft: `5px solid ${batch.status === 'done' ? 'var(--present)' : 'var(--unmarked)'}` }}>
                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '17px', margin: 0 }} className="truncate">{batch.name}</h3>
                          <span className={`badge ${info.cls}`}>{info.label}</span>
                        </div>
                        {batch.schedule && (
                          <p style={{ fontSize: '12px', color: 'var(--slate-400)', fontWeight: 600 }}>🕐 {batch.schedule}</p>
                        )}
                      </div>
                      
                      {/* Interactive circular progress ring */}
                      {batch.status !== 'no-students' && (
                        <ProgressRing 
                          percentage={batch.attendancePct} 
                          size={48} 
                          strokeWidth={4.5} 
                          isUnmarked={batch.status === 'unmarked'} 
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1, height: '40px', minHeight: 'unset' }}
                        onClick={() => navigate(`/attendance/${batch.id}/${today}`)}
                        disabled={batch.status === 'no-students'}>
                        {batch.status === 'done' ? '✓ Edit Attendance' : '📝 Mark Attendance'}
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ height: '40px', minHeight: 'unset', padding: '8px 12px' }} onClick={() => navigate(`/batch/${batch.id}`)}>
                        👥 Students ({batch.studentCount})
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '8px', height: '40px', minHeight: 'unset' }} onClick={() => deleteBatch(batch)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Premium Card Add Trigger */}
            <button
              onClick={() => openAddModal()}
              style={{
                background: 'rgba(15,23,42,0.01)',
                border: '2px dashed var(--slate-300)',
                borderRadius: 'var(--r-lg)',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--slate-500)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(220,38,38,0.01)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-300)'; e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'rgba(15,23,42,0.01)'; }}
            >
              <span>➕ Add Another Class Batch</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editBatch ? 'Edit Batch' : 'New Batch'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Batch Name *</label>
            <input className="input" value={batchName} onChange={e => setBatchName(e.target.value)}
              placeholder="e.g. Saturday 5:30 Batch — Level 3" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Schedule (optional)</label>
            <input className="input" value={batchSchedule} onChange={e => setBatchSchedule(e.target.value)}
              placeholder="e.g. Saturdays at 5:30 PM" />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary btn-full" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-full" onClick={saveBatch} disabled={!batchName.trim() || saving}>
              {saving ? 'Saving…' : editBatch ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showMenuModal} onClose={() => setShowMenuModal(false)} title="Teacher Settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--r-md)', padding: '14px', fontSize: '13px', color: 'var(--slate-600)', border: '1px solid var(--slate-200)' }}>
            <div>Signed in as <strong style={{ color: 'var(--slate-800)' }}>{user?.email}</strong></div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--slate-400)', fontWeight: 600 }}>App Version: v4.0 · Release Build</div>
          </div>
          <button className="btn btn-danger btn-full" onClick={async () => { setShowMenuModal(false); await signOut(); }}>
            Sign Out
          </button>
        </div>
      </Modal>
    </Layout>
  );
}

function getGreeting() {
  const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const h = parseInt(hour, 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
