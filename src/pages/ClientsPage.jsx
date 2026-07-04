import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Trash2, Edit, Eye, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const SERVICES = ['Medical Billing', 'Digital Marketing', 'Web Development', 'Virtual Assistant', 'Prior Authorization', 'Credentialing', 'Revenue Cycle Management', 'SEO', 'Social Media Management'];

const initialForm = {
  company_name: '', contact_person: '', email: '', phone: '', country: '',
  services: '', monthly_charges: '', contract_start: '', contract_end: '',
  status: 'Active', notes: ''
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients', { params: { page, limit: 15, search, status: filterStatus } });
      setClients(res.data.clients);
      setTotal(res.data.total);
    } catch (err) {} finally { setLoading(false); }
  }, [page, search, filterStatus]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const openCreate = () => { setForm(initialForm); setEditItem(null); setErrors({}); setShowModal(true); };
  const openEdit = (item) => {
    setForm({
      company_name: item.company_name || '', contact_person: item.contact_person || '',
      email: item.email || '', phone: item.phone || '', country: item.country || '',
      services: item.services || '', monthly_charges: item.monthly_charges || '',
      contract_start: item.contract_start || '', contract_end: item.contract_end || '',
      status: item.status || 'Active', notes: item.notes || ''
    });
    setEditItem(item); setErrors({}); setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) { setErrors({ company_name: 'Required' }); return; }
    setSaving(true);
    try {
      if (editItem) await api.put(`/clients/${editItem.id}`, form);
      else await api.post('/clients', form);
      setShowModal(false);
      fetchClients();
    } catch (err) {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/clients/${deleteId}`); fetchClients(); } catch (err) {}
    setDeleteId(null);
  };

  const columns = [
    {
      header: 'Client', key: 'company_name',
      render: (row) => (
        <div>
          <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.company_name}</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>{row.contact_person}</p>
        </div>
      )
    },
    { header: 'Services', render: (row) => (
      <span style={{ fontSize: '12px', color: '#475569', maxWidth: '180px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.services || '—'}</span>
    )},
    { header: 'Monthly Charges', render: (row) => (
      <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>
        {row.monthly_charges ? `$${Number(row.monthly_charges).toLocaleString()}` : '—'}
      </span>
    )},
    { header: 'Country', render: (row) => <span style={{ fontSize: '13px', color: '#475569' }}>{row.country || '—'}</span> },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${row.id}`); }} className="p-2 rounded-lg hover:bg-[#DBEAFE] text-[#2563EB]"><Eye size={15} /></button>
          {hasRole('CEO', 'Manager') && (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569]"><Edit size={15} /></button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }} className="p-2 rounded-lg hover:bg-red-50 text-[#DC2626]"><Trash2 size={15} /></button>
            </>
          )}
        </div>
      )
    }
  ];

  const totalMRR = clients.reduce((s, c) => s + (Number(c.monthly_charges) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Client Management"
        subtitle={`${total} clients · MRR: $${totalMRR.toLocaleString()}`}
        actions={
          <>
            <button onClick={fetchClients} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            {hasRole('CEO', 'Manager') && <PrimaryButton onClick={openCreate} icon={Plus}>Add Client</PrimaryButton>}
          </>
        }
      />

      {/* Filters */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input type="text" placeholder="Search clients..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', height: '38px', border: '1px solid #E2E8F0', borderRadius: '10px', paddingLeft: '32px', paddingRight: '12px', fontSize: '13px', background: '#F8FAFC', outline: 'none' }} />
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height: '38px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none' }}>
          <option value="">All Statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        <DataTable columns={columns} data={clients} loading={loading}
          onRowClick={(row) => navigate(`/clients/${row.id}`)}
          emptyState={<EmptyState icon={Briefcase} title="No clients yet" description="Add your first client for U2 Collective LLP." action={hasRole('CEO', 'Manager') && <PrimaryButton onClick={openCreate} icon={Plus}>Add Client</PrimaryButton>} />}
          pagination={{ page, limit: 15, total }} onPageChange={setPage} />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Client' : 'Add Client'} size="lg">
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <FormInput label="Company Name" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} error={errors.company_name} />
            <FormInput label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <FormInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <FormInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <FormInput label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <FormInput label="Monthly Charges ($)" type="number" value={form.monthly_charges} onChange={(e) => setForm({ ...form, monthly_charges: e.target.value })} />
            <FormSelect label="Services" value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })}>
              <option value="">Select service</option>
              {SERVICES.map(s => <option key={s}>{s}</option>)}
            </FormSelect>
            <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Active</option>
              <option>Inactive</option>
            </FormSelect>
            <FormInput label="Contract Start" type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
            <FormInput label="Contract End" type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
            <div style={{ gridColumn: '1 / -1' }}>
              <FormTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editItem ? 'Update' : 'Add Client'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Client" message="Delete this client and all associated data?" confirmLabel="Delete Client" />
    </div>
  );
}
