import React, { useEffect, useState } from 'react';
import { PhoneCall, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const initialCall = { call_status: '', notes: '', practice_manager_name: '', practice_manager_phone: '', practice_manager_email: '', practice_manager_linkedin: '', practice_manager_position: '', followup_date: '', followup_time: '' };

export default function CallerTasksPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialCall);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/leads', { params: { limit: 100 } }); setLeads(res.data.leads || []); }
    catch (error) { setMessage(error.response?.data?.error || 'Unable to load assigned leads.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const open = (lead) => { setSelected(lead); setForm(initialCall); setMessage(''); };
  const save = async (event) => {
    event.preventDefault();
    if (!form.call_status) return setMessage('Select a call status.');
    setSaving(true);
    try { await api.post(`/leads/${selected.id}/call`, form); setMessage('Call activity saved successfully.'); setSelected(null); await load(); }
    catch (error) { setMessage(error.response?.data?.error || 'Unable to save call activity.'); }
    finally { setSaving(false); }
  };

  const columns = [
    { header: 'Lead', render: (row) => <div><strong>{row.lead_id}</strong><p style={{ color: '#64748B', fontSize: '12px' }}>{row.client_clinic_name || row.company_name}</p></div> },
    { header: 'Email', key: 'clinic_email' },
    { header: 'Phone', key: 'clinic_phone' },
    { header: 'State', key: 'state' },
    { header: 'City', key: 'city' },
    { header: 'Specialty', key: 'clinic_specialty' },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Action', align: 'right', render: (row) => <PrimaryButton onClick={() => open(row)} icon={PhoneCall}>Open</PrimaryButton> }
  ];

  return <div>
    <PageHeader title="Assigned Leads" subtitle={`${leads.length} leads assigned to you`} actions={<button onClick={load} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>} />
    {message && <div style={{ padding: '11px 14px', marginBottom: '16px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8' }}>{message}</div>}
    <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden' }}>
      <DataTable columns={columns} data={leads} loading={loading} emptyState={<EmptyState icon={PhoneCall} title="No assigned leads" description="New assignments from the CEO will appear here." />} />
    </div>
    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.lead_id} · ${selected.client_clinic_name || selected.company_name}` : 'Lead'} size="lg">
      {selected && <form onSubmit={save}>
        <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', marginBottom: '18px', color: '#475569', fontSize: '13px' }}>
          <strong>{selected.clinic_email}</strong> · {selected.clinic_phone}<br />{selected.state}, {selected.city} · {selected.clinic_specialty}<br />{selected.notes || 'No notes'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormSelect label="Call Status" required value={form.call_status} onChange={(e) => setForm({ ...form, call_status: e.target.value })}><option value="">Select status</option><option>Called</option><option>No Answer</option></FormSelect>
          <FormTextarea label="Call Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {form.call_status === 'Called' && <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormInput label="Practice Manager Name" value={form.practice_manager_name} onChange={(e) => setForm({ ...form, practice_manager_name: e.target.value })} />
            <FormInput label="Manager Phone" value={form.practice_manager_phone} onChange={(e) => setForm({ ...form, practice_manager_phone: e.target.value })} />
            <FormInput label="Manager Email" type="email" value={form.practice_manager_email} onChange={(e) => setForm({ ...form, practice_manager_email: e.target.value })} />
            <FormInput label="LinkedIn URL" value={form.practice_manager_linkedin} onChange={(e) => setForm({ ...form, practice_manager_linkedin: e.target.value })} />
            <FormInput label="Position / Designation" value={form.practice_manager_position} onChange={(e) => setForm({ ...form, practice_manager_position: e.target.value })} />
            <FormInput label="Follow-up Date" type="date" value={form.followup_date} onChange={(e) => setForm({ ...form, followup_date: e.target.value })} />
            <FormInput label="Follow-up Time" type="time" value={form.followup_time} onChange={(e) => setForm({ ...form, followup_time: e.target.value })} />
          </div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}><SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={saving}>{form.call_status === 'Called' && form.followup_date ? 'Add Follow Up' : 'Save Call'}</PrimaryButton></div>
      </form>}
    </Modal>
  </div>;
}
