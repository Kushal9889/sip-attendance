import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import type { Student, Batch } from '../types/database';

export function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const { showToast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Import States (Group B UX optimization)
  const [importMode, setImportMode] = useState<'single' | 'bulk'>('single');
  const [bulkNames, setBulkNames] = useState('');

  const loadData = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from('batches').select('*').eq('id', batchId).single(),
        supabase.from('students').select('*').eq('batch_id', batchId).eq('is_active', true).order('name'),
      ]);
      setBatch(b as Batch | null);
      setStudents((s ?? []) as Student[]);
    } catch {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openModal = (student?: Student) => {
    setImportMode('single');
    setBulkNames('');
    if (student) { 
      setEditStudent(student); 
      setName(student.name); 
      setContact(student.parent_contact ?? ''); 
    } else { 
      setEditStudent(null); 
      setName(''); 
      setContact(''); 
    }
    setShowModal(true);
  };

  const saveStudent = async () => {
    if (!batchId) return;
    setSaving(true);
    try {
      if (editStudent) {
        // Edit student
        if (!name.trim()) {
          showToast('Student name cannot be empty', 'error');
          setSaving(false);
          return;
        }
        const { error } = await supabase.from('students').update({
          name: name.trim(),
          parent_contact: contact.trim() || null,
        } as Record<string, unknown>).eq('id', editStudent.id);
        if (error) throw error;
        showToast('Student updated!');
      } else if (importMode === 'bulk') {
        // Parse bulk names
        const names = bulkNames
          .split(/,|\n/)
          .map(n => n.trim())
          .filter(n => n.length > 0);
          
        if (names.length === 0) {
          showToast('Please enter at least one name', 'error');
          setSaving(false);
          return;
        }

        const inserts = names.map(n => ({
          batch_id: batchId,
          name: n,
          is_active: true,
          enrollment_date: new Date().toISOString().split('T')[0],
        }));

        const { error } = await supabase.from('students').insert(inserts as Record<string, unknown>[]);
        if (error) throw error;
        showToast(`Successfully enrolled ${names.length} students!`);
      } else {
        // Add single student
        if (!name.trim()) {
          showToast('Student name cannot be empty', 'error');
          setSaving(false);
          return;
        }
        const { error } = await supabase.from('students').insert({
          batch_id: batchId,
          name: name.trim(),
          parent_contact: contact.trim() || null,
          is_active: true,
          enrollment_date: new Date().toISOString().split('T')[0],
        } as Record<string, unknown>);
        if (error) throw error;
        showToast('Student added!');
      }
      setShowModal(false);
      loadData();
    } catch {
      showToast('Could not save student', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (student: Student) => {
    if (!confirm(`Remove "${student.name}" from this batch?`)) return;
    const { error } = await supabase.from('students').update({ is_active: false } as Record<string, unknown>).eq('id', student.id);
    if (error) { showToast('Could not remove', 'error'); return; }
    showToast(`${student.name} removed`);
    loadData();
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Search filtering
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title={batch?.name ?? 'Students'} backTo="/">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <p style={{ fontSize: '13px', color: 'var(--slate-500)', fontWeight: 600, margin: 0 }}>
          {loading ? '…' : `${students.length} student${students.length !== 1 ? 's' : ''} enrolled`}
          {batch?.schedule && ` · ${batch.schedule}`}
        </p>
        {!loading && (
          <button className="btn btn-secondary btn-sm" onClick={() => openModal()} style={{ minHeight: 'unset', padding: '6px 14px', borderRadius: 'var(--r-full)' }}>
            ➕ Add Student
          </button>
        )}
      </div>

      {/* Search Input Box */}
      {!loading && students.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input 
            className="input" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="🔍 Search student by name..." 
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
      )}

      {loading ? (
        <div className="loading-screen" style={{ height: '240px' }}><div className="spinner" /></div>
      ) : students.length === 0 ? (
        <div className="empty-state" style={{ background: 'var(--slate-50)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--slate-300)' }}>
          <div className="empty-icon">👥</div>
          <h3 style={{ fontSize: '18px' }}>No Students Enrolled</h3>
          <p style={{ color: 'var(--slate-400)' }}>Add your students to start marking attendance for this batch.</p>
          <button className="btn btn-primary" onClick={() => openModal()} style={{ marginTop: '12px' }}>
            ➕ Add First Student
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card card-list-responsive">
            {filteredStudents.map((student, idx) => (
              <div key={student.id} className="list-item" style={{ padding: '16px' }}>
                <div className="avatar" style={{
                  background: `linear-gradient(135deg, hsl(${(idx * 79) % 360}, 65%, 55%), hsl(${(idx * 79 + 35) % 360}, 65%, 45%))`
                }}>
                  {getInitials(student.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingLeft: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--slate-800)' }} className="truncate">
                    {student.name}
                  </div>
                  {student.parent_contact && (
                    <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>📱</span> <span>{student.parent_contact}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '8px', width: '36px', height: '36px', borderRadius: '50%' }} onClick={() => openModal(student)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '8px', width: '36px', height: '36px', borderRadius: '50%', color: 'var(--absent)' }} onClick={() => removeStudent(student)}>🗑️</button>
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--slate-400)', fontWeight: 600, fontSize: '13px' }}>
                No students match "{searchQuery}"
              </div>
            )}
          </div>

          {/* Premium Card Add Trigger */}
          <button
            onClick={() => openModal()}
            style={{
              background: 'rgba(15,23,42,0.01)',
              border: '2px dashed var(--slate-300)',
              borderRadius: 'var(--r-lg)',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--slate-500)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(220,38,38,0.01)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-300)'; e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'rgba(15,23,42,0.01)'; }}
          >
            <span>➕ Add Another Student</span>
          </button>
        </div>
      )}

      {/* Add/Edit Student Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editStudent ? 'Edit Student Details' : 'Add Student'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Tab selector for Bulk vs Single, only on add mode */}
          {!editStudent && (
            <div style={{ display: 'flex', background: 'var(--slate-100)', padding: '4px', borderRadius: 'var(--r-md)', marginBottom: '8px' }}>
              <button 
                onClick={() => setImportMode('single')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: importMode === 'single' ? 'white' : 'transparent',
                  color: importMode === 'single' ? 'var(--slate-800)' : 'var(--slate-500)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👤 Single Student
              </button>
              <button 
                onClick={() => setImportMode('bulk')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background: importMode === 'bulk' ? 'white' : 'transparent',
                  color: importMode === 'bulk' ? 'var(--slate-800)' : 'var(--slate-500)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👥 Paste Bulk List
              </button>
            </div>
          )}

          {importMode === 'bulk' && !editStudent ? (
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '6px' }}>Names (separated by commas or newlines)</label>
              <textarea 
                className="input" 
                value={bulkNames} 
                onChange={e => setBulkNames(e.target.value)} 
                placeholder="e.g. Aaradhya, Virat, Rohan, Arnav" 
                style={{ minHeight: '120px', padding: '12px', fontSize: '13px', resize: 'vertical', fontFamily: 'var(--font-body)' }}
              />
              <p style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '6px', fontWeight: 600 }}>
                💡 Tip: You can copy and paste names directly from a WhatsApp message or class roster sheet.
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Student Name *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name of student" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Parent Contact Number</label>
                <input className="input" value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. +91 9876543210" type="tel" />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary btn-full" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-full" onClick={saveStudent} disabled={(importMode === 'bulk' ? !bulkNames.trim() : !name.trim()) || saving}>
              {saving ? 'Saving…' : editStudent ? 'Save Changes' : importMode === 'bulk' ? 'Import Students' : 'Add Student'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
