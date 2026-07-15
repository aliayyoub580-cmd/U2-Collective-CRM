import React, { useEffect, useState } from 'react';
import { Building2, ClipboardEdit, ExternalLink, PhoneCall, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

const blank = () => ({ call_status: '', contact_person_name: '', contact_person_role: '', call_date: new Date().toISOString().split('T')[0], call_time: '', call_duration: '', interest_status: '', follow_up_required: false, follow_up_date: '', notes: '', additional_contact_information: '' });
const websiteHref = (website) => /^https?:\/\//i.test(website) ? website : `https://${website}`;

function LeadField({ label, value, children }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><div className="break-words text-sm font-semibold text-slate-800">{children || value || <span className="font-normal text-slate-400">Not provided</span>}</div></div>;
}

export default function CallerTasksPage() {
  const [leads, setLeads] = useState([]); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blank()); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [formError, setFormError] = useState('');
  const load = async () => { setLoading(true); try { const response = await api.get('/caller/leads'); setLeads(response.data.leads || []); } catch (error) { setMessage(error.response?.data?.error || 'Unable to load assigned leads.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const open = (lead) => { setSelected(lead); setForm(blank()); setFormError(''); setMessage(''); };
  const save = async (event) => { event.preventDefault(); if (!form.call_status || !form.call_date || !form.interest_status) return setFormError('Call status, call date and interest status are required.'); if (form.follow_up_required && !form.follow_up_date) return setFormError('Select a follow-up date.'); setSaving(true); setFormError(''); try { await api.post(`/caller/leads/${selected.id}/complete`, form); setSelected(null); setMessage('Caller outcome submitted to the Manager and Admin.'); await load(); } catch (error) { setFormError(error.response?.data?.error || 'Unable to submit caller outcome.'); } finally { setSaving(false); } };
  const columns = [
    { header: 'Lead', render: (row) => <div><strong>{row.lead_id}</strong><p className="max-w-[260px] whitespace-normal text-xs text-slate-500">{row.client_clinic_name || row.company_name}</p></div> },
    { header: 'Website', render: (row) => row.clinic_website ? <a href={websiteHref(row.clinic_website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">Open <ExternalLink size={13}/></a> : '-' },
    { header: 'Email', render: (row) => row.clinic_email || '-' }, { header: 'Phone', key: 'clinic_phone' },
    { header: 'Specialty', render: (row) => row.clinic_specialty || '-' }, { header: 'Location', render: (row) => [row.city, row.state].filter(Boolean).join(', ') || '-' },
    { header: 'Source', render: (row) => row.source === 'Other' ? row.source_other : row.source || '-' }, { header: 'Clinic Size', render: (row) => row.practice_size || '-' },
    { header: 'Manager', render: (row) => row.manager?.name || '-' },
    { header: 'Instructions', wrap: true, render: (row) => <span className="block min-w-[180px] max-w-[260px]">{row.caller_instructions || '-'}</span> }, { header: 'Due', render: (row) => row.caller_due_date ? new Date(row.caller_due_date).toLocaleDateString() : '-' },
    { header: 'Status', render: (row) => <StatusBadge status={String(row.workflow_status || row.status).replaceAll('_', ' ')} /> },
    { header: 'Action', align: 'right', render: (row) => <PrimaryButton onClick={() => open(row)} icon={PhoneCall}>Open</PrimaryButton> }
  ];
  return <div><PageHeader title="Assigned Leads" subtitle={`${leads.length} leads assigned to you`} actions={<button onClick={load} className="p-2 rounded-xl text-slate-600"><RefreshCw size={16}/></button>}/>{message && <div className="mb-4 rounded-xl bg-blue-50 p-3 text-blue-700">{message}</div>}<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><DataTable columns={columns} data={leads} loading={loading} emptyState={<EmptyState icon={PhoneCall} title="No assigned leads" description="New assignments from your Manager will appear here."/>}/></div>
    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.lead_id} - ${selected.client_clinic_name || selected.company_name}` : 'Lead'} size="xl">{selected && <form onSubmit={save} className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/50">
        <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-100/70 px-5 py-4"><span className="rounded-xl bg-blue-600 p-2 text-white"><Building2 size={18}/></span><div><h3 className="font-bold text-slate-900">Generated Lead Data</h3><p className="text-xs text-slate-600">Read-only information supplied by the lead generator or Admin</p></div></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <LeadField label="Clinic Name" value={selected.client_clinic_name || selected.company_name}/>
          <LeadField label="Clinic Website">{selected.clinic_website && <a href={websiteHref(selected.clinic_website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">{selected.clinic_website}<ExternalLink size={13}/></a>}</LeadField>
          <LeadField label="Clinic Email" value={selected.clinic_email}/>
          <LeadField label="Clinic Phone" value={selected.clinic_phone}/>
          <LeadField label="Specialty" value={selected.clinic_specialty}/>
          <LeadField label="Clinic Size" value={selected.practice_size}/>
          <LeadField label="City" value={selected.city}/>
          <LeadField label="State" value={selected.state}/>
          <LeadField label="Lead Source" value={selected.source === 'Other' ? selected.source_other : selected.source}/>
          <LeadField label="Assigned Date" value={selected.assigned_at ? new Date(selected.assigned_at).toLocaleString() : null}/>
          <div className="sm:col-span-2 lg:col-span-3"><LeadField label="Lead Notes" value={selected.notes || selected.caller_instructions}/></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4"><span className="rounded-xl bg-violet-600 p-2 text-white"><ClipboardEdit size={18}/></span><div><h3 className="font-bold text-slate-900">Caller Outcome</h3><p className="text-xs text-slate-600">Complete these fields after contacting the clinic</p></div></div>
        <div className="p-5">
          {formError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-2"><FormSelect label="Call Status" required value={form.call_status} onChange={(e) => setForm({...form,call_status:e.target.value})}><option value="">Select status</option>{['Called','Busy','No Answer','Wrong Number'].map((item) => <option key={item}>{item}</option>)}</FormSelect><FormSelect label="Interest Status" required value={form.interest_status} onChange={(e) => setForm({...form,interest_status:e.target.value})}><option value="">Select interest status</option>{['Interested','Not Interested','Needs Follow-Up','Decision Maker Not Reached'].map((item) => <option key={item}>{item}</option>)}</FormSelect><FormInput label="Contact Person Name" value={form.contact_person_name} onChange={(e) => setForm({...form,contact_person_name:e.target.value})}/><FormInput label="Contact Person Role" value={form.contact_person_role} onChange={(e) => setForm({...form,contact_person_role:e.target.value})}/><FormInput label="Call Date" type="date" required value={form.call_date} onChange={(e) => setForm({...form,call_date:e.target.value})}/><FormInput label="Call Time" type="time" value={form.call_time} onChange={(e) => setForm({...form,call_time:e.target.value})}/><FormInput label="Call Duration" placeholder="e.g. 8 minutes" value={form.call_duration} onChange={(e) => setForm({...form,call_duration:e.target.value})}/><label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4" checked={form.follow_up_required} onChange={(e) => setForm({...form,follow_up_required:e.target.checked})}/> Follow-up required</label>{form.follow_up_required && <FormInput label="Follow-up Date" type="date" required value={form.follow_up_date} onChange={(e) => setForm({...form,follow_up_date:e.target.value})}/>}<div className="space-y-4 md:col-span-2"><FormTextarea label="Call Notes" rows={4} value={form.notes} onChange={(e) => setForm({...form,notes:e.target.value})}/><FormTextarea label="Additional Contact Information" placeholder="Write the contact details of the clinic manager" rows={3} value={form.additional_contact_information} onChange={(e) => setForm({...form,additional_contact_information:e.target.value})}/></div></div>
        </div>
      </section>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white py-4"><SecondaryButton onClick={() => setSelected(null)}>Cancel</SecondaryButton><PrimaryButton type="submit" loading={saving}>Submit Caller Outcome</PrimaryButton></div>
    </form>}</Modal>
  </div>;
}
