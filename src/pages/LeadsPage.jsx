import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Edit, Trash2, Eye, RefreshCw } from 'lucide-react';
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
const SOURCES = ['LinkedIn', 'Meta Ads', 'Referral', 'Website', 'Upwork', 'Fiverr', 'Cold Email', 'Other'];
const STATUSES = ['Not contract', 'Contracted', 'Follow up', 'Meeting scheduled', 'Not interested'];
const NON_MEDICAL_BILLING_STATUSES = ['Follow up', 'Meeting scheduled', 'Not interested'];
const COMM_TYPES = ['LinkedIn Message', 'Email', 'Phone Call', 'WhatsApp', 'Zoom Meeting', 'Google Meet', 'Proposal Sent', 'Client Feedback', 'Internal Note'];
const PRACTICE_SIZES = ['Solo practice', 'Small 2 - 5 providers', 'Medium 6 - 15 providers', 'Larger 15+ provider'];
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Pakistan', 'India', 'United Arab Emirates', 'Saudi Arabia', 'Other'];

const initialForm = {
  company_name: '', clinic_website: '', clinic_linkedin: '',
  clinic_phone: '', clinic_email: '',
  country: '', state: '', city: '', source: '', service_interested: '', practice_size: '',
  status: 'Not contract', assigned_to: '', communication_type: '', notes: ''
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, search, status: filterStatus, source: filterSource, assigned_to: filterAssignedTo };
      const res = await api.get('/leads', { params });
      setLeads(res.data.leads);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterSource, filterAssignedTo]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    api.get('/employees/users/all').then(res => setUsers(res.data.users || [])).catch(() => {});
  }, []);

  const openCreate = () => { setForm(initialForm); setEditLead(null); setErrors({}); setShowModal(true); };
  const openEdit = (lead) => {
    setForm({
      company_name: lead.client_clinic_name || lead.company_name || '',
      clinic_website: lead.clinic_website || '',
      clinic_linkedin: lead.clinic_linkedin || '',
      clinic_phone: lead.clinic_phone || '',
      clinic_email: lead.clinic_email || '',
      country: lead.country || '', state: lead.state || '', city: lead.city || '', source: lead.source || '',
      service_interested: lead.service_interested || '',
      practice_size: lead.practice_size || '',
      status: lead.status || 'Not contract',
      assigned_to: lead.assigned_to || '', communication_type: '', notes: lead.notes || ''
    });
    setEditLead(lead);
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.company_name.trim()) e.company_name = 'Client clinic name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editLead) {
        await api.put(`/leads/${editLead.id}`, form);
      } else {
        await api.post('/leads', form);
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/leads/${deleteId}`);
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
    setDeleteId(null);
  };

  const columns = [
    {
      header: 'Client Clinic Name', key: 'company_name',
      render: (row) => (
        <div>
          <p style={{ fontWeight: '600', color: '#0F172A', fontSize: '14px' }}>{row.client_clinic_name || row.company_name}</p>
          <p style={{ fontSize: '12px', color: '#64748B' }}>{row.clinic_email || row.clinic_phone || row.clinic_website}</p>
        </div>
      )
    },
    { header: 'Lead ID', key: 'lead_id', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.lead_id || `#${row.id}`}</span>
    )},
    { header: 'Service', key: 'service_interested', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.service_interested || '—'}</span>
    )},
    { header: 'Source', key: 'source', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.source || '—'}</span>
    )},
    { header: 'Status', key: 'status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Assigned To', key: 'assigned_to_name', render: (row) => (
      <span style={{ fontSize: '13px', color: '#475569' }}>{row.assigned_to_name || '—'}</span>
    )},
    {
      header: 'Actions', key: 'actions', align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/leads/${row.id}`); }}
            className="p-2 rounded-lg hover:bg-[#DBEAFE] text-[#2563EB] transition-colors" title="View">
            <Eye size={15} />
          </button>
          {hasRole('CEO', 'Manager', 'Sales Representative') && (
            <button onClick={(e) => { e.stopPropagation(); openEdit(row); }}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors" title="Edit">
              <Edit size={15} />
            </button>
          )}
          {hasRole('CEO', 'Manager') && (
            <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
              className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  const isMedicalBilling = form.service_interested === 'Medical Billing';
  const isNonMedicalBillingService = form.service_interested && !isMedicalBilling;
  const statusOptions = isNonMedicalBillingService ? NON_MEDICAL_BILLING_STATUSES : STATUSES;
  const handleServiceChange = (service) => {
    const nextStatusOptions = service && service !== 'Medical Billing' ? NON_MEDICAL_BILLING_STATUSES : STATUSES;
    setForm({
      ...form,
      service_interested: service,
      practice_size: service === 'Medical Billing' ? form.practice_size : '',
      status: nextStatusOptions.includes(form.status) ? form.status : nextStatusOptions[0]
    });
  };

  return (
    <div>
      <PageHeader
        title="Lead Management"
        subtitle={`${total} total leads`}
        actions={
          <>
            <button onClick={fetchLeads} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569] transition-colors">
              <RefreshCw size={16} />
            </button>
            {hasRole('CEO', 'Manager', 'Sales Representative') && (
              <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>
            )}
          </>
        }
      />

      {/* Filters */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: '18px', padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div className="relative flex-1" style={{ minWidth: '200px' }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', height: '40px', border: '1px solid #E2E8F0',
              borderRadius: '10px', paddingLeft: '36px', paddingRight: '14px',
              fontSize: '13px', outline: 'none', background: '#F8FAFC'
            }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height: '40px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none', minWidth: '140px' }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
          style={{ height: '40px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none', minWidth: '140px' }}
        >
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterAssignedTo}
          onChange={(e) => { setFilterAssignedTo(e.target.value); setPage(1); }}
          style={{ height: '40px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none', minWidth: '150px' }}
        >
          <option value="">All Assigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={leads}
          loading={loading}
          onRowClick={(row) => navigate(`/leads/${row.id}`)}
          emptyState={
            <EmptyState
              icon={Users}
              title="No leads found"
              description="Start by adding your first lead for U2 Collective LLP."
              action={hasRole('CEO', 'Manager', 'Sales Representative') && (
                <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>
              )}
            />
          }
          pagination={{ page, limit: 15, total }}
          onPageChange={(p) => setPage(p)}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editLead ? 'Edit Lead' : 'Add New Lead'} size="lg">
        <form onSubmit={handleSave}>
          <div className="lead-form-grid">
            <FormInput label="Client Clinic Name" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} error={errors.company_name} placeholder="Enter clinic name" />
            <FormInput label="Clinic Website" type="url" value={form.clinic_website} onChange={(e) => setForm({ ...form, clinic_website: e.target.value })} placeholder="https://clinic.com" />
            <FormInput label="Clinic LinkedIn" value={form.clinic_linkedin} onChange={(e) => setForm({ ...form, clinic_linkedin: e.target.value })} placeholder="Clinic LinkedIn URL" />
            <FormInput label="Clinic Phone" type="tel" value={form.clinic_phone} onChange={(e) => setForm({ ...form, clinic_phone: e.target.value })} placeholder="+1 555 000 0000" />
            <FormInput label="Clinic Email" type="email" value={form.clinic_email} onChange={(e) => setForm({ ...form, clinic_email: e.target.value })} placeholder="clinic@example.com" />
            <FormSelect label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </FormSelect>
            <FormInput label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State (optional)" />
            <FormInput label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City (optional)" />
            <FormSelect label="Lead Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="">Select source</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </FormSelect>
            <FormSelect label="Service" value={form.service_interested} onChange={(e) => handleServiceChange(e.target.value)}>
              <option value="">Select service</option>
              {SERVICES.map(s => <option key={s}>{s}</option>)}
            </FormSelect>
            {isMedicalBilling && (
              <FormSelect label="Practice Size" value={form.practice_size} onChange={(e) => setForm({ ...form, practice_size: e.target.value })}>
                <option value="">Select practice size</option>
                {PRACTICE_SIZES.map(s => <option key={s}>{s}</option>)}
              </FormSelect>
            )}
            <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statusOptions.map(s => <option key={s}>{s}</option>)}
            </FormSelect>
            <FormSelect label="Assign To" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </FormSelect>
            <FormSelect label="Communication Type" value={form.communication_type} onChange={(e) => setForm({ ...form, communication_type: e.target.value })}>
              <option value="">Select type</option>
              {COMM_TYPES.map(t => <option key={t}>{t}</option>)}
            </FormSelect>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormTextarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={saving}>{editLead ? 'Update Lead' : 'Create Lead'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This will also remove all associated follow-ups, communications, and proposals."
        confirmLabel="Delete Lead"
      />
    </div>
  );
}
