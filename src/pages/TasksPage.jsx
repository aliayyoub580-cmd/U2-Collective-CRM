import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckSquare, Trash2, Edit, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const initialForm = { title: '', description: '', assigned_to: '', deadline: '', priority: 'Medium', status: 'Pending' };

export default function TasksPage() {
  const { hasRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: { page, limit: 15, status: filterStatus, priority: filterPriority } });
      setTasks(res.data.tasks);
      setTotal(res.data.total);
    } catch (err) {} finally { setLoading(false); }
  }, [page, filterStatus, filterPriority]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => {
    api.get('/employees/users/all').then(r => setUsers(r.data.users || [])).catch(() => {});
  }, []);

  const openCreate = () => { setForm(initialForm); setEditItem(null); setErrors({}); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ title: item.title, description: item.description || '', assigned_to: item.assigned_to || '', deadline: item.deadline || '', priority: item.priority, status: item.status });
    setEditItem(item); setErrors({}); setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.assigned_to) e.assigned_to = 'Assign to an employee';
    if (!form.deadline) e.deadline = 'Deadline is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editItem) await api.put(`/tasks/${editItem.id}`, form);
      else await api.post('/tasks', form);
      setShowModal(false);
      fetchTasks();
    } catch (err) {} finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/tasks/${id}/status`, { status });
      fetchTasks();
    } catch (err) {}
  };

  const handleDelete = async () => {
    try { await api.delete(`/tasks/${deleteId}`); fetchTasks(); } catch (err) {}
    setDeleteId(null);
  };

  const today = new Date().toISOString().split('T')[0];

  const columns = [
    {
      header: 'Task', key: 'title',
      render: (row) => (
        <div>
          <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.title}</p>
          {row.description && <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</p>}
        </div>
      )
    },
    { header: 'Assigned To', render: (row) => <span style={{ fontSize: '13px' }}>{row.assigned_to_name || '—'}</span> },
    {
      header: 'Deadline', render: (row) => (
        <span style={{ fontSize: '13px', color: row.deadline < today && row.status !== 'Completed' ? '#DC2626' : '#475569', fontWeight: row.deadline < today && row.status !== 'Completed' ? '600' : '400' }}>
          {row.deadline || '—'}
        </span>
      )
    },
    { header: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { header: 'Status', render: (row) => (
      <select
        value={row.status}
        onChange={(e) => handleStatusChange(row.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        style={{ fontSize: '12px', fontWeight: '600', border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none', color: '#0F172A' }}
      >
        {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
      </select>
    )},
    {
      header: 'Actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          {hasRole('CEO', 'Manager') && (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors"><Edit size={15} /></button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }} className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626] transition-colors"><Trash2 size={15} /></button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Task Management"
        subtitle={`${total} total tasks`}
        actions={
          <>
            <button onClick={fetchTasks} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            {hasRole('CEO', 'Manager') && <PrimaryButton onClick={openCreate} icon={Plus}>Add Task</PrimaryButton>}
          </>
        }
      />

      {/* Filters */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['', 'Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: `1px solid ${filterStatus === s ? '#2563EB' : '#E2E8F0'}`,
              background: filterStatus === s ? '#DBEAFE' : '#FFFFFF',
              color: filterStatus === s ? '#1D4ED8' : '#475569', cursor: 'pointer'
            }}>
            {s || 'All'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
            style={{ height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none' }}>
            <option value="">All Priorities</option>
            {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        <DataTable columns={columns} data={tasks} loading={loading}
          emptyState={<EmptyState icon={CheckSquare} title="No tasks found" description="Create tasks and assign them to employees." action={hasRole('CEO', 'Manager') && <PrimaryButton onClick={openCreate} icon={Plus}>Add Task</PrimaryButton>} />}
          pagination={{ page, limit: 15, total }} onPageChange={setPage} />
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Task' : 'Create Task'} size="md">
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Task Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
            <FormTextarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormSelect label="Assign To" required value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} error={errors.assigned_to}>
                <option value="">Select employee</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </FormSelect>
              <FormInput label="Deadline" type="date" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} error={errors.deadline} />
              <FormSelect label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
              </FormSelect>
              <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
              </FormSelect>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editItem ? 'Update' : 'Create Task'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Task" message="Delete this task permanently?" confirmLabel="Delete" />
    </div>
  );
}
