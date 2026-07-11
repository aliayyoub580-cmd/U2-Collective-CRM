import React, { useCallback, useEffect, useState } from 'react';
import { Edit, Eye, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge from '../components/StatusBadge';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const SOURCES = ['Google', 'Reddit', 'LinkedIn', 'Facebook', 'Indeed', 'Glassdoor', 'Instagram', 'Other'];
const STATES = ['California', 'Florida', 'Hawaii', 'Illinois', 'Maryland', 'Massachusetts', 'New Hampshire', 'New York', 'Ohio', 'Texas'];
const SIZES = ['Solo Practice (1 Provider)', 'Small Clinic (2–5 Providers)', 'Medium Clinic (6–15 Providers)', 'Large Clinic (16+ Providers)'];
const STATUSES = ['New', 'Assigned', 'Called', 'No Answer', 'Interested', 'Not Interested'];
const emptyForm = { company_name: '', clinic_email: '', clinic_specialty: '', clinic_phone: '', state: '', city: '', source: '', source_other: '', practice_size: '', assigned_to: '', notes: '' };

export default function LeadsPage() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const canCreate = hasRole('CEO') || user?.employee_type === 'lead_generator';
  const [leads, setLeads] = useState([]); const [users, setUsers] = useState([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [status, setStatus] = useState(''); const [source, setSource] = useState(''); const [state, setState] = useState('');
  const [show, setShow] = useState(false); const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm); const [errors, setErrors] = useState({}); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');

  const load = useCallback(async () => { setLoading(true); try { const res = await api.get('/leads', { params: { page, limit: 15, search, status, source, state } }); setLeads(res.data.leads || []); setTotal(res.data.total || 0); } catch (e) { setNotice(e.response?.data?.error || 'Unable to load leads.'); } finally { setLoading(false); } }, [page, search, status, source, state]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (hasRole('CEO')) api.get('/employees/users/all').then((res) => setUsers(res.data.users || [])).catch(() => {}); }, [hasRole]);
  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setShow(true); };
  const openEdit = (lead) => { setEditing(lead); setForm({ ...emptyForm, company_name: lead.client_clinic_name || lead.company_name || '', clinic_email: lead.clinic_email || '', clinic_specialty: lead.clinic_specialty || '', clinic_phone: lead.clinic_phone || '', state: lead.state || '', city: lead.city || '', source: lead.source || '', source_other: lead.source_other || '', practice_size: lead.practice_size || '', assigned_to: lead.assigned_to || '', notes: lead.notes || '' }); setShow(true); };
  const save = async (event) => {
    event.preventDefault();
    const next = {};
    ['company_name','clinic_email','clinic_specialty','clinic_phone','state','city','source','practice_size'].forEach((key) => { if (!String(form[key] || '').trim()) next[key] = 'Required'; });
    if (form.source === 'Other' && !form.source_other.trim()) next.source_other = 'Specify the source';
    setErrors(next); if (Object.keys(next).length) return; setSaving(true);
    try {
      const response = editing ? await api.put(`/leads/${editing.id}`, form) : await api.post('/leads', form);
      const leadId = editing?.id || response.data.lead.id;
      if (hasRole('CEO') && form.assigned_to && String(form.assigned_to) !== String(editing?.assigned_to || '')) await api.patch(`/leads/${leadId}/assign`, { assigned_to: form.assigned_to });
      setShow(false); setNotice(editing ? 'Lead updated.' : 'Lead created successfully.'); load();
    } catch (e) { setErrors({ general: e.response?.data?.error || 'Unable to save lead.' }); }
    finally { setSaving(false); }
  };
  const remove = async () => { try { await api.delete(`/leads/${deleting}`); setNotice('Lead deleted.'); load(); } catch (e) { setNotice(e.response?.data?.error || 'Unable to delete lead.'); } setDeleting(null); };

  const columns = [
    { header: 'Lead ID', key: 'lead_id' },
    { header: 'Clinic', render: (r) => <div><strong>{r.client_clinic_name || r.company_name}</strong><p style={{ fontSize: 12, color: '#64748B' }}>{r.clinic_email}</p></div> },
    { header: 'Specialty', key: 'clinic_specialty' }, { header: 'Phone', key: 'clinic_phone' }, { header: 'State', key: 'state' }, { header: 'City', key: 'city' },
    { header: 'Source', render: (r) => r.source === 'Other' ? r.source_other : r.source }, { header: 'Clinic Size', key: 'practice_size' }, { header: 'Created By', key: 'created_by_name' },
    { header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() }, { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { header: 'Actions', align: 'right', render: (r) => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}><button onClick={() => navigate(`/leads/${r.id}`)} className="p-2 rounded-lg text-blue-600"><Eye size={15}/></button>{canCreate && <button onClick={() => openEdit(r)} className="p-2 rounded-lg text-slate-600"><Edit size={15}/></button>}{hasRole('CEO') && <button onClick={() => setDeleting(r.id)} className="p-2 rounded-lg text-red-600"><Trash2 size={15}/></button>}</div> }
  ];
  return <div><PageHeader title={user?.role === 'Manager' ? 'Manager Review Queue' : 'Healthcare Leads'} subtitle={`${total} leads`} actions={<><button onClick={load} className="p-2 rounded-xl text-slate-600"><RefreshCw size={16}/></button>{canCreate && <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>}</>} />
    {notice && <div style={{ padding: 12, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 12, marginBottom: 16 }}>{notice}</div>}
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 16, background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 18 }}><div className="relative" style={{ flex: 1, minWidth: 220 }}><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ID, clinic, email, phone, state or source" style={{ width: '100%', height: 40, paddingLeft: 36, border: '1px solid #E2E8F0', borderRadius: 10 }}/></div><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select><select value={state} onChange={(e) => setState(e.target.value)}><option value="">All states</option>{STATES.map(x => <option key={x}>{x}</option>)}</select><select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
    <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden' }}><DataTable columns={columns} data={leads} loading={loading} pagination={{ page, limit: 15, total }} onPageChange={setPage} emptyState={<EmptyState icon={Users} title="No leads found" description="No healthcare leads match these filters." action={canCreate && <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>}/>} /></div>
    <Modal isOpen={show} onClose={() => setShow(false)} title={editing ? 'Edit Healthcare Lead' : 'Create Healthcare Lead'} size="lg"><form onSubmit={save}>{errors.general && <p style={{ color: '#DC2626', marginBottom: 12 }}>{errors.general}</p>}<div className="lead-form-grid"><FormInput label="Clinic Name" required value={form.company_name} error={errors.company_name} onChange={(e) => setForm({...form,company_name:e.target.value})}/><FormInput label="Clinic Email" type="email" required value={form.clinic_email} error={errors.clinic_email} onChange={(e) => setForm({...form,clinic_email:e.target.value})}/><FormInput label="Clinic Specialty" required value={form.clinic_specialty} error={errors.clinic_specialty} onChange={(e) => setForm({...form,clinic_specialty:e.target.value})}/><FormInput label="Clinic Phone Number" required value={form.clinic_phone} error={errors.clinic_phone} onChange={(e) => setForm({...form,clinic_phone:e.target.value})}/><FormSelect label="State" required value={form.state} error={errors.state} onChange={(e) => setForm({...form,state:e.target.value})}><option value="">Select state</option>{STATES.map(x=><option key={x}>{x}</option>)}</FormSelect><FormInput label="City" required value={form.city} error={errors.city} onChange={(e) => setForm({...form,city:e.target.value})}/><FormSelect label="Lead Source" required value={form.source} error={errors.source} onChange={(e) => setForm({...form,source:e.target.value})}><option value="">Select source</option>{SOURCES.map(x=><option key={x}>{x}</option>)}</FormSelect>{form.source==='Other'&&<FormInput label="Specify Lead Source" required value={form.source_other} error={errors.source_other} onChange={(e)=>setForm({...form,source_other:e.target.value})}/>}<FormSelect label="Clinic Practice" required value={form.practice_size} error={errors.practice_size} onChange={(e)=>setForm({...form,practice_size:e.target.value})}><option value="">Select clinic size</option>{SIZES.map(x=><option key={x}>{x}</option>)}</FormSelect>{hasRole('CEO')&&<FormSelect label="Assign Caller" value={form.assigned_to} onChange={(e)=>setForm({...form,assigned_to:e.target.value})}><option value="">Unassigned</option>{users.filter(x=>x.employee_type==='caller').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>}<div style={{gridColumn:'1 / -1'}}><FormTextarea label="Notes" rows={5} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div></div><div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:20}}><SecondaryButton onClick={()=>setShow(false)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={saving}>{editing?'Update Lead':'Create Lead'}</PrimaryButton></div></form></Modal>
    <ConfirmDialog isOpen={!!deleting} onClose={()=>setDeleting(null)} onConfirm={remove} title="Delete Lead" message="Delete this lead and its linked workflow records?" confirmLabel="Delete"/>
  </div>;
}
