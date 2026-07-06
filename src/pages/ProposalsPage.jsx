import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Trash2, Edit, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Rejected'];
const initialForm = { lead_id: '', client_id: '', title: '', amount: '', status: 'Draft', sent_date: '', notes: '' };

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/proposals', { params: { page, limit: 15, status: filterStatus } });
      setProposals(res.data.proposals);
      setTotal(res.data.total);
    } catch (err) {} finally { setLoading(false); }
  }, [page, filterStatus]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);
  useEffect(() => {
    Promise.all([
      api.get('/leads', { params: { limit: 100 } }),
      api.get('/clients', { params: { limit: 100 } })
    ]).then(([lr, cr]) => { setLeads(lr.data.leads || []); setClients(cr.data.clients || []); }).catch(() => {});
  }, []);

  const openCreate = () => { setForm(initialForm); setEditItem(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ lead_id: item.lead_id || '', client_id: item.client_id || '', title: item.title || '', amount: item.amount || '', status: item.status, sent_date: item.sent_date || '', notes: item.notes || '' });
    setEditItem(item); setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (editItem) await api.put(`/proposals/${editItem.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/proposals', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowModal(false);
      fetchProposals();
    } catch (err) {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/proposals/${deleteId}`); fetchProposals(); } catch (err) {}
    setDeleteId(null);
  };

  const columns = [
    {
      header: 'Proposal', key: 'title',
      render: (row) => (
        <div>
          <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.title}</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>{row.lead_name || row.client_name || '—'}</p>
        </div>
      )
    },
    { header: 'Amount', render: (row) => (
      <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>
        ${Number(row.amount || 0).toLocaleString()}
      </span>
    )},
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Sent Date', render: (row) => <span style={{ fontSize: '13px', color: '#475569' }}>{row.sent_date || '—'}</span> },
    { header: 'Created', render: (row) => <span style={{ fontSize: '12px', color: '#94A3B8' }}>{new Date(row.created_at).toLocaleDateString()}</span> },
    {
      header: 'Actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569]"><Edit size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }} className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626]"><Trash2 size={15} /></button>
        </div>
      )
    }
  ];

  const totalValue = proposals.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Proposals"
        subtitle={`${total} proposals · Total value: $${totalValue.toLocaleString()}`}
        actions={
          <>
            <button onClick={fetchProposals} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            <PrimaryButton onClick={openCreate} icon={Plus}>Create Proposal</PrimaryButton>
          </>
        }
      />

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', ...PROPOSAL_STATUSES].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            style={{
              padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
              border: `1px solid ${filterStatus === s ? '#2563EB' : '#E2E8F0'}`,
              background: filterStatus === s ? '#DBEAFE' : '#FFFFFF',
              color: filterStatus === s ? '#1D4ED8' : '#475569', cursor: 'pointer'
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        <DataTable columns={columns} data={proposals} loading={loading}
          emptyState={<EmptyState icon={FileText} title="No proposals yet" description="Create and track proposals for your leads and clients." action={<PrimaryButton onClick={openCreate} icon={Plus}>Create Proposal</PrimaryButton>} />}
          pagination={{ page, limit: 15, total }} onPageChange={setPage} />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Proposal' : 'Create Proposal'} size="md">
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Proposal Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FormSelect label="Related Lead" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value, client_id: '' })}>
                <option value="">No lead</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
              </FormSelect>
              <FormSelect label="Related Client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, lead_id: '' })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </FormSelect>
              <FormInput label="Amount ($)" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {PROPOSAL_STATUSES.map(s => <option key={s}>{s}</option>)}
              </FormSelect>
              <FormInput label="Sent Date" type="date" value={form.sent_date} onChange={(e) => setForm({ ...form, sent_date: e.target.value })} />
            </div>
            <FormTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editItem ? 'Update' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Proposal" message="Delete this proposal permanently?" confirmLabel="Delete" />
    </div>
  );
}
