import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Bell, Check, Trash2, Calendar, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';

const METHODS = ['Phone Call', 'Email', 'LinkedIn', 'WhatsApp', 'Zoom Meeting', 'Google Meet', 'Other'];

const initialForm = {
  lead_id: '', title: '', followup_date: new Date().toISOString().split('T')[0],
  followup_time: '', method: '', notes: '', assigned_to: ''
};

export default function FollowUpsPage() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, today: 0, overdue: 0, completed: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, limit: 15,
        status: filterType === 'completed' ? 'Completed' : filterStatus,
        today: filterType === 'today' ? 'true' : undefined,
        overdue: filterType === 'overdue' ? 'true' : undefined
      };
      const res = await api.get('/followups', { params });
      setFollowups(res.data.followups || []);
      setTotal(res.data.total || 0);
      setCounts(res.data.counts || { all: res.data.total || 0, today: 0, overdue: 0, completed: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType]);

  useEffect(() => { fetchFollowups(); }, [fetchFollowups]);

  useEffect(() => {
    if (user?.employee_type === 'caller') return;
    Promise.all([
      api.get('/leads', { params: { limit: 100 } }),
      api.get('/employees/users/all')
    ]).then(([leadsRes, usersRes]) => {
      setLeads(leadsRes.data.leads || []);
      setUsers(usersRes.data.users || []);
    }).catch(() => {});
  }, [user?.employee_type]);

  const openCreate = () => { setForm(initialForm); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({
      lead_id: item.lead_id || '', title: item.title || '',
      followup_date: item.followup_date || '', followup_time: item.followup_time || '',
      method: item.method || '', notes: item.notes || '',
      assigned_to: item.assigned_to || '', status: item.status || 'Pending'
      , interest_status: '', contract_type: '', not_interested_reason: ''
    });
    setEditItem(item);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        if (user?.employee_type === 'caller' && form.interest_status) await api.patch(`/followups/${editItem.id}/resolve`, form);
        else await api.put(`/followups/${editItem.id}`, form);
      } else {
        await api.post('/followups', form);
      }
      setShowModal(false);
      fetchFollowups();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.patch(`/followups/${id}/complete`);
      fetchFollowups();
    } catch (err) {}
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/followups/${deleteId}`);
      fetchFollowups();
    } catch (err) {}
    setDeleteId(null);
  };

  const columns = [
    {
      header: 'Lead Name', key: 'lead_name',
      render: (row) => (
        <div>
          <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.lead_name || row.title}</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>{row.clinic_email || row.clinic_phone || 'No contact added'}</p>
        </div>
      )
    },
    { header: 'Lead ID', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.lead_public_id || (row.lead_id ? `#${row.lead_id}` : '-')}</span>
    )},
    { header: 'Client Clinic Name', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.client_clinic_name || row.lead_name || '-'}</span>
    )},
    { header: 'Source', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.source || '-'}</span>
    )},
    { header: 'Service', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.service_interested || '-'}</span>
    )},
    { header: 'Call Date', render: (row) => (
      <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '500' }}>{row.call_date || '-'}</span>
    )},
    { header: 'Follow-up Date & Time', render: (row) => (
      <div>
        <p style={{ fontSize: '13px', color: '#0F172A', fontWeight: '500' }}>{row.followup_date || '-'}</p>
        {row.followup_time && <p style={{ fontSize: '12px', color: '#64748B' }}>{row.followup_time}</p>}
      </div>
    )},
    { header: 'Assigned To', render: (row) => <span style={{ fontSize: '13px' }}>{row.assigned_to_name || '-'}</span> },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          {!row.is_lead_followup && row.status === 'Pending' && (
            <button onClick={() => handleComplete(row.id)}
              className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Mark Complete">
              <Check size={15} />
            </button>
          )}
          {!row.is_lead_followup && (
            <>
              <button onClick={() => openEdit(row)}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors" title="Edit">
                <Calendar size={15} />
              </button>
              <button onClick={() => setDeleteId(row.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626] transition-colors" title="Delete">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const todayCount = counts.today || 0;
  const overdueCount = counts.overdue || 0;
  const completedCount = counts.completed || 0;
  const canReviewCompleted = ['CEO', 'Manager'].includes(user?.role);

  return (
    <div>
      <PageHeader
        title="Follow-Up Tracker"
        subtitle={`${counts.all || total} total follow-ups`}
        actions={
          <>
            <button onClick={fetchFollowups} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            {user?.employee_type !== 'caller' && <PrimaryButton onClick={openCreate} icon={Plus}>Add Follow-up</PrimaryButton>}
          </>
        }
      />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: `All Follow-ups (${counts.all || total})` },
          { value: 'today', label: `Today (${todayCount})`, color: '#F59E0B' },
          { value: 'overdue', label: `Overdue (${overdueCount})`, color: '#DC2626' },
          ...(canReviewCompleted ? [{ value: 'completed', label: `Completed Leads (${completedCount})`, color: '#16A34A' }] : [])
        ].map(f => (
          <button key={f.value} onClick={() => { setFilterType(f.value); if (f.value === 'completed') setFilterStatus(''); setPage(1); }}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
              border: `1px solid ${filterType === f.value ? (f.color || '#2563EB') : '#E2E8F0'}`,
              background: filterType === f.value ? (f.color || '#2563EB') + '15' : '#FFFFFF',
              color: filterType === f.value ? (f.color || '#2563EB') : '#475569',
              cursor: 'pointer', transition: 'all 0.15s'
            }}>
            {f.label}
          </button>
        ))}
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); if (filterType === 'completed') setFilterType('all'); setPage(1); }}
          style={{ height: '38px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none' }}
        >
          <option value="">All Statuses</option>
          <option>Follow up</option>
          <option>Pending</option>
          <option>Completed</option>
        </select>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={followups}
          loading={loading}
          emptyState={
            <EmptyState icon={Bell} title="No follow-ups found" description="Schedule follow-ups to stay on top of your leads."
              action={user?.employee_type !== 'caller' && <PrimaryButton onClick={openCreate} icon={Plus}>Add Follow-up</PrimaryButton>} />
          }
          pagination={{ page, limit: 15, total }}
          onPageChange={setPage}
        />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Follow-up' : 'Schedule Follow-up'} size="md">
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Follow-up title" />
            {user?.employee_type !== 'caller' && <FormSelect label="Related Lead" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">No lead linked</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.client_clinic_name || l.company_name}</option>)}
            </FormSelect>}
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormInput label="Date" type="date" required value={form.followup_date} onChange={(e) => setForm({ ...form, followup_date: e.target.value })} />
              <FormInput label="Time" type="time" value={form.followup_time} onChange={(e) => setForm({ ...form, followup_time: e.target.value })} />
            </div>
            {user?.employee_type !== 'caller' && <><FormSelect label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="">Select method</option>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </FormSelect>
            <FormSelect label="Assign To" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Select employee</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </FormSelect></>}
            {editItem && (
              <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Pending</option>
                <option>Completed</option>
              </FormSelect>
            )}
            {editItem && user?.employee_type === 'caller' && editItem.status === 'Pending' && <>
              <FormSelect label="Interest Status" value={form.interest_status || ''} onChange={(e) => setForm({ ...form, interest_status: e.target.value })}><option value="">Select interest</option><option>Interested</option><option>Not Interested</option></FormSelect>
              {form.interest_status === 'Interested' && <FormSelect label="Contract Type" value={form.contract_type || ''} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}><option value="">Select contract type</option><option>Outsource</option><option>In-House Billing</option><option>Freelancer</option></FormSelect>}
              {form.interest_status === 'Not Interested' && <FormTextarea label="Reason" required value={form.not_interested_reason || ''} onChange={(e) => setForm({ ...form, not_interested_reason: e.target.value })} rows={3} />}
            </>}
            <FormTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editItem ? 'Update' : 'Schedule'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Follow-up" message="Remove this follow-up?" confirmLabel="Delete" />
    </div>
  );
}
