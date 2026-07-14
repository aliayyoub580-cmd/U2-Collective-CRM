import React, { useCallback, useEffect, useState } from 'react';
import { CheckSquare, Eye, Mail, RefreshCw, Search, Send, UserCheck, Users } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';
import { useAuth } from '../context/AuthContext';

const tabs = [
  ['', 'All'], ['assigned_to_manager', 'New'], ['assigned_to_lead_generator', 'Lead Generation'],
  ['submitted_by_lead_generator', 'Review'], ['approved_for_caller', 'Approved'],
  ['assigned_to_caller', 'Caller Queue'], ['caller_completed', 'Caller Completed'],
  ['manager_follow_up', 'Follow-up'], ['manager_completed', 'Completed']
];
const emailTemplates = {
  initial: { subject: 'Introduction from U2 Collective - {{clinic_name}}', body: 'Hello {{contact_name}},\n\nI am {{manager_name}} from U2 Collective. I am reaching out regarding {{clinic_name}} and lead {{lead_id}}.\n\nBest regards,\n{{manager_name}}' },
  day_3: { subject: 'Following up - {{clinic_name}}', body: 'Hello {{contact_name}},\n\nI wanted to follow up on my introduction regarding {{clinic_name}}. Please let me know a convenient time to connect.\n\nBest,\n{{manager_name}}' },
  day_7: { subject: 'Checking in - {{clinic_name}}', body: 'Hello {{contact_name}},\n\nI am checking in again to see whether U2 Collective can support {{clinic_name}}.\n\nBest,\n{{manager_name}}' },
  day_14: { subject: 'Final follow-up - {{clinic_name}}', body: 'Hello {{contact_name}},\n\nThis is my final follow-up for now regarding {{clinic_name}}. You are welcome to reply whenever the timing is right.\n\nBest,\n{{manager_name}}' }
};
const blank = { assignee: '', priority: 'Normal', due_date: '', instructions: '', task_title: '', task_description: '', review_notes: '', email_stage: 'initial', recipient_email: '', subject: '', message_body: '', interest_status: 'interested', manager_notes: '', communication_summary: '', closure_reason: '', decision_maker_name: '', decision_maker_role: '', preferred_contact_method: '', next_step: '', next_follow_up_at: '', reason_not_interested: '', conversion_details: '', confirmed: false };

const pretty = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleDateString() : '-';

export default function ManagerLeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [action, setAction] = useState(null); const [selected, setSelected] = useState(null); const [detail, setDetail] = useState(null);
  const [people, setPeople] = useState([]); const [form, setForm] = useState(blank); const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await api.get('/manager/leads', { params: { page, limit: 15, status, search } }); setLeads(response.data.leads || []); setTotal(response.data.total || 0); }
    catch (err) { setNotice(err.response?.data?.error || 'Unable to load Manager leads.'); }
    finally { setLoading(false); }
  }, [page, status, search]);
  useEffect(() => { load(); }, [load]);

  const fillTemplate = (stage, lead) => {
    const clinic = lead.client_clinic_name || lead.company_name || 'your clinic';
    const values = { clinic_name: clinic, company_name: clinic, contact_name: lead.decision_maker_name || 'Clinic Team', manager_name: user?.name || 'U2 Collective Manager', manager_email: user?.email || '', manager_phone: '', lead_id: lead.lead_id || '' };
    const replace = (text) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), text);
    return { subject: replace(emailTemplates[stage].subject), message_body: replace(emailTemplates[stage].body) };
  };
  const open = async (kind, lead) => {
    setAction(kind); setSelected(lead); setError(''); setForm({ ...blank, recipient_email: lead.clinic_email || '', priority: lead.priority || 'Normal', ...(kind === 'email' ? fillTemplate('initial', lead) : {}) });
    if (kind === 'caller') {
      try { const response = await api.get('/employees/users/all', { params: { employee_type: 'caller' } }); setPeople(response.data.users || []); } catch { setPeople([]); }
    }
    if (kind === 'detail') {
      setDetail(null);
      try { const response = await api.get(`/manager/leads/${lead.id}`); setDetail(response.data); } catch (err) { setError(err.response?.data?.error || 'Unable to load lead history.'); }
    }
  };

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const id = selected.id;
      if (action === 'caller') await api.post(`/manager/leads/${id}/assign-caller`, { caller_id: form.assignee, priority: form.priority, due_date: form.due_date || null, instructions: form.instructions });
      if (action === 'task') await api.post('/tasks', { lead_id: id, assigned_to: selected.lead_generator_id, title: form.task_title, description: form.task_description, deadline: form.due_date, priority: form.priority === 'Normal' ? 'Medium' : form.priority, status: 'Pending' });
      if (action === 'return') await api.post(`/manager/leads/${id}/return-to-lead-generator`, { review_notes: form.review_notes });
      if (action === 'approve') await api.post(`/manager/leads/${id}/approve`, { review_notes: form.review_notes });
      if (action === 'reject') await api.post(`/manager/leads/${id}/reject`, { review_notes: form.review_notes });
      if (action === 'email') await api.post(`/manager/leads/${id}/email`, { email_stage: form.email_stage, recipient_email: form.recipient_email, subject: form.subject, message_body: form.message_body });
      if (action === 'complete') await api.post(`/manager/leads/${id}/complete`, form);
      setAction(null); setNotice('Lead workflow updated successfully.'); load();
    } catch (err) { setError(err.response?.data?.error || 'Unable to update this lead.'); }
    finally { setSaving(false); }
  };

  const actions = (lead) => {
    const workflow = lead.workflow_status || 'new';
    return <div className="flex justify-end gap-1 flex-wrap">
      <button className="p-2 text-blue-600" title="View full history" onClick={() => open('detail', lead)}><Eye size={15}/></button>
      {['assigned_to_manager','new','approved_for_caller','caller_completed','manager_follow_up'].includes(workflow) && <button className="p-2 text-emerald-600" title="Assign Caller" onClick={() => open('caller', lead)}><UserCheck size={15}/></button>}
      {lead.lead_generator_id && !['manager_completed','not_interested','converted','rejected','cancelled','archived'].includes(workflow) && <button className="p-2 text-violet-600" title="Create task for this lead" onClick={() => open('task', lead)}><CheckSquare size={15}/></button>}
      {['submitted_by_lead_generator','under_manager_review'].includes(workflow) && <><button className="p-2 text-orange-600" title="Return for correction" onClick={() => open('return', lead)}><Send size={15}/></button><button className="px-2 text-xs font-bold text-red-600" title="Reject" onClick={() => open('reject', lead)}>Reject</button><button className="p-2 text-green-600" title="Approve" onClick={() => open('approve', lead)}><UserCheck size={15}/></button></>}
      {['caller_completed','manager_follow_up'].includes(workflow) && <><button className="p-2 text-indigo-600" title="Email follow-up" onClick={() => open('email', lead)}><Mail size={15}/></button><button className="px-2 text-xs font-bold text-green-700" onClick={() => open('complete', lead)}>Complete</button></>}
    </div>;
  };
  const columns = [
    { header: 'Lead', render: (lead) => <div><strong>{lead.lead_id}</strong><div className="text-xs text-slate-500">{lead.client_clinic_name || lead.company_name}</div></div> },
    { header: 'Stage', render: (lead) => <StatusBadge status={pretty(lead.workflow_status)} /> },
    { header: 'Lead Generator', render: (lead) => lead.lead_generator_name || '-' }, { header: 'Caller', render: (lead) => lead.caller_name || '-' },
    { header: 'Interest', render: (lead) => pretty(lead.interest_status) || '-' }, { header: 'Priority', render: (lead) => <StatusBadge status={lead.priority || 'Normal'} /> },
    { header: 'Due', render: (lead) => date(lead.caller_due_date || lead.lead_generation_due_date) }, { header: 'Actions', align: 'right', render: actions }
  ];

  return <div>
    <PageHeader title="Manager Leads" subtitle={`${total} leads assigned to you`} actions={<button onClick={load} className="p-2 rounded-xl text-slate-600"><RefreshCw size={16}/></button>} />
    {notice && <div className="mb-4 rounded-xl bg-blue-50 p-3 text-blue-700">{notice}</div>}
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search clinic, lead ID, email, phone, city or state" className="h-10 w-full rounded-xl border border-slate-200 pl-9"/></div>
      <div className="flex flex-wrap gap-2">{tabs.map(([value,label]) => <button key={label} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-full px-3 py-2 text-xs font-bold ${status === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><DataTable columns={columns} data={leads} loading={loading} pagination={{ page, limit: 15, total }} onPageChange={setPage} emptyState={<EmptyState icon={Users} title="No leads in this queue" description="Only leads assigned to your Manager account appear here."/>}/></div>

    <Modal isOpen={!!action && action !== 'detail'} onClose={() => setAction(null)} title={pretty(action)} size="lg"><form onSubmit={submit}>
      {error && <p className="mb-3 text-red-600">{error}</p>}
      {action === 'caller' && <div className="grid gap-4 md:grid-cols-2"><FormSelect label="Caller" required value={form.assignee} onChange={(e) => setForm({...form,assignee:e.target.value})}><option value="">Select caller</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.email})</option>)}</FormSelect><FormSelect label="Priority" value={form.priority} onChange={(e) => setForm({...form,priority:e.target.value})}>{['Low','Normal','High','Urgent'].map((item) => <option key={item}>{item}</option>)}</FormSelect><FormInput label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm({...form,due_date:e.target.value})}/><div className="md:col-span-2"><FormTextarea label="Instructions" rows={4} value={form.instructions} onChange={(e) => setForm({...form,instructions:e.target.value})}/></div></div>}
      {action === 'task' && <div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><p className="mb-3 text-sm text-slate-600">Assign to {selected?.lead_generator_name || 'the lead generator'} for {selected?.lead_id}.</p><FormInput label="Task Title" required value={form.task_title} onChange={(e) => setForm({...form,task_title:e.target.value})}/></div><FormInput label="Deadline" type="date" required value={form.due_date} onChange={(e) => setForm({...form,due_date:e.target.value})}/><FormSelect label="Priority" value={form.priority} onChange={(e) => setForm({...form,priority:e.target.value})}>{['Low','Normal','High','Urgent'].map((item) => <option key={item}>{item}</option>)}</FormSelect><div className="md:col-span-2"><FormTextarea label="Task Description" rows={4} value={form.task_description} onChange={(e) => setForm({...form,task_description:e.target.value})}/></div></div>}
      {(action === 'return' || action === 'approve' || action === 'reject') && <FormTextarea label="Review Notes" required={action !== 'approve'} rows={5} value={form.review_notes} onChange={(e) => setForm({...form,review_notes:e.target.value})}/>}
      {action === 'email' && <div className="grid gap-4 md:grid-cols-2"><FormSelect label="Email Stage / Template" value={form.email_stage} onChange={(e) => { const stage = e.target.value; setForm({...form,email_stage:stage,...fillTemplate(stage,selected)}); }}><option value="initial">Initial Email</option><option value="day_3">Day 3 Follow-up</option><option value="day_7">Day 7 Follow-up</option><option value="day_14">Day 14 Follow-up</option></FormSelect><FormInput label="Recipient" type="email" required value={form.recipient_email} onChange={(e) => setForm({...form,recipient_email:e.target.value})}/><FormInput label="Subject" required value={form.subject} onChange={(e) => setForm({...form,subject:e.target.value})}/><div className="md:col-span-2"><FormTextarea label="Message" required rows={7} value={form.message_body} onChange={(e) => setForm({...form,message_body:e.target.value})}/></div><p className="md:col-span-2 text-xs text-slate-500">Template variables are filled automatically and remain editable. Email records remain drafts until a verified mail provider is configured.</p></div>}
      {action === 'complete' && <div className="grid gap-4 md:grid-cols-2"><FormSelect label="Final Interest Status" required value={form.interest_status} onChange={(e) => setForm({...form,interest_status:e.target.value})}>{['interested','maybe_interested','not_interested','needs_more_information','follow_up_required','converted','no_response','invalid_lead'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</FormSelect><FormInput label="Decision Maker Name" value={form.decision_maker_name} onChange={(e) => setForm({...form,decision_maker_name:e.target.value})}/><FormInput label="Decision Maker Role" value={form.decision_maker_role} onChange={(e) => setForm({...form,decision_maker_role:e.target.value})}/><FormInput label="Preferred Contact Method" value={form.preferred_contact_method} onChange={(e) => setForm({...form,preferred_contact_method:e.target.value})}/><FormInput label="Next Step" value={form.next_step} onChange={(e) => setForm({...form,next_step:e.target.value})}/>{form.interest_status === 'follow_up_required' && <FormInput label="Next Follow-up" type="datetime-local" required value={form.next_follow_up_at} onChange={(e) => setForm({...form,next_follow_up_at:e.target.value})}/>} {form.interest_status === 'not_interested' && <FormInput label="Reason Not Interested" required value={form.reason_not_interested} onChange={(e) => setForm({...form,reason_not_interested:e.target.value})}/>} {form.interest_status === 'converted' && <FormInput label="Conversion Details" required value={form.conversion_details} onChange={(e) => setForm({...form,conversion_details:e.target.value})}/>}<div className="md:col-span-2"><FormTextarea label="Manager Notes" required rows={4} value={form.manager_notes} onChange={(e) => setForm({...form,manager_notes:e.target.value})}/><FormTextarea label="Communication Summary" required rows={4} value={form.communication_summary} onChange={(e) => setForm({...form,communication_summary:e.target.value})}/><FormTextarea label="Closure Reason" required rows={3} value={form.closure_reason} onChange={(e) => setForm({...form,closure_reason:e.target.value})}/><label className="mt-3 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={form.confirmed} onChange={(e) => setForm({...form,confirmed:e.target.checked})}/> I confirm the final outcome is complete and accurate.</label></div></div>}
      <div className="mt-5 flex justify-end gap-3"><SecondaryButton onClick={() => setAction(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={saving}>Save Workflow</PrimaryButton></div>
    </form></Modal>

    <Modal isOpen={action === 'detail'} onClose={() => setAction(null)} title={`${selected?.lead_id || ''} Full History`} size="lg">{error && <p className="text-red-600">{error}</p>}{!detail ? <p className="text-slate-500">Loading history...</p> : <div className="space-y-5"><section><h3 className="font-bold">Clinic and Ownership</h3><p>{detail.lead.client_clinic_name || detail.lead.company_name} | Manager: {detail.lead.manager_name || '-'} | Lead Generator: {detail.lead.lead_generator_name || '-'} | Caller: {detail.lead.caller_name || '-'}</p></section><section><h3 className="font-bold">Caller Outcomes</h3>{detail.callerOutcomes.length ? detail.callerOutcomes.map((item) => <div key={item.id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{item.call_status}</b> on {date(item.call_date)} | {item.interest_status}<p>{item.notes || 'No notes'}</p></div>) : <p className="text-slate-500">No caller outcomes.</p>}</section><section><h3 className="font-bold">Email Follow-ups</h3>{detail.emails.length ? detail.emails.map((item) => <div key={item.id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{pretty(item.email_stage)}</b>: {item.subject} ({item.status})</div>) : <p className="text-slate-500">No email records.</p>}</section><section><h3 className="font-bold">Status History</h3>{detail.statusHistory.map((item) => <div key={item.id} className="mt-2 border-l-2 border-blue-500 pl-3 text-sm">{pretty(item.previous_status)} → {pretty(item.new_status)} <span className="text-slate-400">{new Date(item.created_at).toLocaleString()}</span><p>{item.reason}</p></div>)}</section></div>}</Modal>
  </div>;
}
