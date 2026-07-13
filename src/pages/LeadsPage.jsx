import React, { useCallback, useEffect, useState } from 'react';
import { Edit, Eye, Plus, RefreshCw, Search, Send, Trash2, UserCheck, Users } from 'lucide-react';
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
  const canAssign = hasRole('CEO');
  const [leads, setLeads] = useState([]); const [users, setUsers] = useState([]); const [managers, setManagers] = useState([]); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [status, setStatus] = useState(''); const [source, setSource] = useState(''); const [state, setState] = useState('');
  const [show, setShow] = useState(false); const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null);
  const [assigning, setAssigning] = useState(null); const [callerId, setCallerId] = useState(''); const [assigningLead, setAssigningLead] = useState(false); const [assignError, setAssignError] = useState('');
  const [managerLead, setManagerLead] = useState(null); const [managerForm, setManagerForm] = useState({ manager_id: '', priority: 'Normal', due_date: '', instructions: '' });
  const [form, setForm] = useState(emptyForm); const [errors, setErrors] = useState({}); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');

  const load = useCallback(async () => { setLoading(true); try { const res = await api.get('/leads', { params: { page, limit: 15, search, status, source, state } }); setLeads(res.data.leads || []); setTotal(res.data.total || 0); } catch (e) { setNotice(e.response?.data?.error || 'Unable to load leads.'); } finally { setLoading(false); } }, [page, search, status, source, state]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canAssign) return;
    Promise.all([api.get('/employees/users/all', { params: { employee_type: 'caller' } }), api.get('/employees/users/all')]).then(([callers, all]) => { setUsers(callers.data.users || []); setManagers((all.data.users || []).filter((person) => person.role === 'Manager')); }).catch(() => { setUsers([]); setManagers([]); });
  }, [canAssign]);
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
      if (canAssign && form.assigned_to && String(form.assigned_to) !== String(editing?.assigned_to || '')) await api.patch(`/leads/${leadId}/assign`, { assigned_to: form.assigned_to });
      setShow(false); setNotice(editing ? 'Lead updated.' : 'Lead created successfully.'); load();
    } catch (e) { setErrors({ general: e.response?.data?.error || 'Unable to save lead.' }); }
    finally { setSaving(false); }
  };
  const openAssign = (lead) => { setAssigning(lead); setCallerId(lead.assigned_to || ''); setAssignError(''); };
  const assignLead = async (event) => {
    event.preventDefault();
    if (!callerId) return setAssignError('Select a caller');
    setAssigningLead(true);
    try {
      await api.patch(`/leads/${assigning.id}/assign`, { assigned_to: callerId });
      setAssigning(null); setNotice('Lead assigned to caller successfully.'); load();
    } catch (error) { setAssignError(error.response?.data?.error || 'Unable to assign lead.'); }
    finally { setAssigningLead(false); }
  };
  const remove = async () => { try { await api.delete(`/leads/${deleting}`); setNotice('Lead deleted.'); load(); } catch (e) { setNotice(e.response?.data?.error || 'Unable to delete lead.'); } setDeleting(null); };
  const assignManager = async (event) => { event.preventDefault(); setAssigningLead(true); setAssignError(''); try { await api.post(`/admin/leads/${managerLead.id}/assign-manager`, managerForm); setManagerLead(null); setNotice('Manager assigned successfully.'); load(); } catch (e) { setAssignError(e.response?.data?.error || 'Unable to assign Manager.'); } finally { setAssigningLead(false); } };
  const removeManager = async () => { setAssigningLead(true); setAssignError(''); try { await api.delete(`/admin/leads/${managerLead.id}/manager`); setManagerLead(null); setNotice('Manager assignment removed and retained in history.'); load(); } catch (e) { setAssignError(e.response?.data?.error || 'Unable to remove Manager assignment.'); } finally { setAssigningLead(false); } };
  const submitLead = async (lead) => { try { await api.post(`/leads/${lead.id}/submit`); setNotice('Lead submitted to the assigned Manager.'); load(); } catch (e) { setNotice(e.response?.data?.error || 'Unable to submit lead.'); } };

  const columns = [
    { header: 'Lead ID', key: 'lead_id' },
    { header: 'Clinic', render: (r) => <div><strong>{r.client_clinic_name || r.company_name}</strong><p style={{ fontSize: 12, color: '#64748B' }}>{r.clinic_email}</p></div> },
    { header: 'Specialty', key: 'clinic_specialty' }, { header: 'Phone', key: 'clinic_phone' }, { header: 'State', key: 'state' }, { header: 'City', key: 'city' },
    { header: 'Source', render: (r) => r.source === 'Other' ? r.source_other : r.source }, { header: 'Clinic Size', key: 'practice_size' }, { header: 'Created By', key: 'created_by_name' },
    { header: 'Manager', key: 'manager_name' }, { header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() }, { header: 'Status', render: (r) => <StatusBadge status={(r.workflow_status || r.status).replaceAll?.('_', ' ') || r.status} /> },
    { header: 'Actions', align: 'right', render: (r) => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}><button onClick={() => navigate(`/leads/${r.id}`)} className="p-2 rounded-lg text-blue-600" title="View lead"><Eye size={15}/></button>{hasRole('CEO') && <button onClick={() => { setManagerLead(r); setManagerForm({ manager_id: r.manager_id || '', priority: r.priority || 'Normal', due_date: r.manager_due_date || '', instructions: r.manager_assignment_notes || '' }); setAssignError(''); }} className="p-2 rounded-lg text-violet-600" title="Assign Manager"><Users size={15}/></button>}{user?.employee_type === 'lead_generator' && !['submitted_by_lead_generator','under_manager_review','approved_for_caller','assigned_to_caller','caller_in_progress','caller_completed','manager_follow_up','manager_completed','converted','not_interested'].includes(r.workflow_status) && <button onClick={() => submitLead(r)} className="p-2 rounded-lg text-green-600" title="Submit to Manager"><Send size={15}/></button>}{canCreate && <button onClick={() => openEdit(r)} className="p-2 rounded-lg text-slate-600" title="Edit lead"><Edit size={15}/></button>}{hasRole('CEO') && <button onClick={() => setDeleting(r.id)} className="p-2 rounded-lg text-red-600" title="Delete lead"><Trash2 size={15}/></button>}</div> }
  ];
  return <div><PageHeader title={user?.role === 'Manager' ? 'Manager Review Queue' : 'Healthcare Leads'} subtitle={`${total} leads`} actions={<><button onClick={load} className="p-2 rounded-xl text-slate-600"><RefreshCw size={16}/></button>{canCreate && <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>}</>} />
    {notice && <div style={{ padding: 12, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 12, marginBottom: 16 }}>{notice}</div>}
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 16, background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 18 }}><div className="relative" style={{ flex: 1, minWidth: 220 }}><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ID, clinic, email, phone, state or source" style={{ width: '100%', height: 40, paddingLeft: 36, border: '1px solid #E2E8F0', borderRadius: 10 }}/></div><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select><select value={state} onChange={(e) => setState(e.target.value)}><option value="">All states</option>{STATES.map(x => <option key={x}>{x}</option>)}</select><select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
    <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 18, overflow: 'hidden' }}><DataTable columns={columns} data={leads} loading={loading} pagination={{ page, limit: 15, total }} onPageChange={setPage} emptyState={<EmptyState icon={Users} title="No leads found" description="No healthcare leads match these filters." action={canCreate && <PrimaryButton onClick={openCreate} icon={Plus}>Add Lead</PrimaryButton>}/>} /></div>
    <Modal isOpen={show} onClose={() => setShow(false)} title={editing ? 'Edit Healthcare Lead' : 'Create Healthcare Lead'} size="lg"><form onSubmit={save}>{errors.general && <p style={{ color: '#DC2626', marginBottom: 12 }}>{errors.general}</p>}<div className="lead-form-grid"><FormInput label="Clinic Name" required value={form.company_name} error={errors.company_name} onChange={(e) => setForm({...form,company_name:e.target.value})}/><FormInput label="Clinic Email" type="email" required value={form.clinic_email} error={errors.clinic_email} onChange={(e) => setForm({...form,clinic_email:e.target.value})}/><FormInput label="Clinic Specialty" required value={form.clinic_specialty} error={errors.clinic_specialty} onChange={(e) => setForm({...form,clinic_specialty:e.target.value})}/><FormInput label="Clinic Phone Number" required value={form.clinic_phone} error={errors.clinic_phone} onChange={(e) => setForm({...form,clinic_phone:e.target.value})}/><FormSelect label="State" required value={form.state} error={errors.state} onChange={(e) => setForm({...form,state:e.target.value})}><option value="">Select state</option>{STATES.map(x=><option key={x}>{x}</option>)}</FormSelect><FormInput label="City" required value={form.city} error={errors.city} onChange={(e) => setForm({...form,city:e.target.value})}/><FormSelect label="Lead Source" required value={form.source} error={errors.source} onChange={(e) => setForm({...form,source:e.target.value})}><option value="">Select source</option>{SOURCES.map(x=><option key={x}>{x}</option>)}</FormSelect>{form.source==='Other'&&<FormInput label="Specify Lead Source" required value={form.source_other} error={errors.source_other} onChange={(e)=>setForm({...form,source_other:e.target.value})}/>}<FormSelect label="Clinic Practice" required value={form.practice_size} error={errors.practice_size} onChange={(e)=>setForm({...form,practice_size:e.target.value})}><option value="">Select clinic size</option>{SIZES.map(x=><option key={x}>{x}</option>)}</FormSelect>{canAssign&&<FormSelect label="Assign Caller" value={form.assigned_to} onChange={(e)=>setForm({...form,assigned_to:e.target.value})}><option value="">Unassigned</option>{users.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FormSelect>}<div style={{gridColumn:'1 / -1'}}><FormTextarea label="Notes" rows={5} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></div></div><div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:20}}><SecondaryButton onClick={()=>setShow(false)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={saving}>{editing?'Update Lead':'Create Lead'}</PrimaryButton></div></form></Modal>
    <Modal isOpen={!!assigning} onClose={() => setAssigning(null)} title="Assign Lead to Caller" size="sm"><form onSubmit={assignLead}>{assignError && <p style={{ color: '#DC2626', marginBottom: 12 }}>{assignError}</p>}<FormSelect label="Caller" required value={callerId} onChange={(event) => setCallerId(event.target.value)}><option value="">Select caller</option>{users.map((caller) => <option key={caller.id} value={caller.id}>{caller.name}</option>)}</FormSelect><div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:20}}><SecondaryButton onClick={() => setAssigning(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={assigningLead} icon={UserCheck}>Assign Caller</PrimaryButton></div></form></Modal>
    <Modal isOpen={!!managerLead} onClose={() => setManagerLead(null)} title="Assign Lead to Manager" size="sm"><form onSubmit={assignManager}>{assignError && <p style={{ color: '#DC2626', marginBottom: 12 }}>{assignError}</p>}<FormSelect label="Manager" required value={managerForm.manager_id} onChange={(e) => setManagerForm({...managerForm,manager_id:e.target.value})}><option value="">Select Manager</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</FormSelect><FormSelect label="Priority" value={managerForm.priority} onChange={(e) => setManagerForm({...managerForm,priority:e.target.value})}>{['Low','Normal','High','Urgent'].map((item) => <option key={item}>{item}</option>)}</FormSelect><FormInput label="Due Date" type="date" value={managerForm.due_date} onChange={(e) => setManagerForm({...managerForm,due_date:e.target.value})}/><FormTextarea label="Instructions" rows={4} value={managerForm.instructions} onChange={(e) => setManagerForm({...managerForm,instructions:e.target.value})}/><div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:20}}>{managerLead?.manager_id && <button type="button" onClick={removeManager} disabled={assigningLead} className="text-sm font-bold text-red-600">Remove Assignment</button>}<div className="flex gap-2"><SecondaryButton onClick={() => setManagerLead(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={assigningLead}>Assign Manager</PrimaryButton></div></div></form></Modal>
    <ConfirmDialog isOpen={!!deleting} onClose={()=>setDeleting(null)} onConfirm={remove} title="Delete Lead" message="Delete this lead and its linked workflow records?" confirmLabel="Delete"/>
  </div>;
}
