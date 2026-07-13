import React, { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw, Search, Trophy } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

const pretty = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminCompletedLeadsPage() {
  const [leads, setLeads] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [interest, setInterest] = useState(''); const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); const [notice, setNotice] = useState('');
  const load = useCallback(async () => { setLoading(true); try { const response = await api.get('/admin/leads/completed-by-manager', { params: { page, limit: 15, search, interest_status: interest } }); setLeads(response.data.leads || []); setTotal(response.data.total || 0); } catch (error) { setNotice(error.response?.data?.error || 'Unable to load completed leads.'); } finally { setLoading(false); } }, [page, search, interest]);
  useEffect(() => { load(); }, [load]);
  const open = async (lead) => { setDetail({ lead, loading: true }); try { const response = await api.get(`/admin/leads/${lead.id}/full-history`); setDetail(response.data); } catch (error) { setNotice(error.response?.data?.error || 'Unable to load lead history.'); setDetail(null); } };
  const columns = [
    { header: 'Lead', render: (lead) => <div><b>{lead.lead_id}</b><div className="text-xs text-slate-500">{lead.client_clinic_name || lead.company_name}</div></div> },
    { header: 'Manager', key: 'manager_name' }, { header: 'Lead Generator', render: (lead) => lead.lead_generator_name || '-' }, { header: 'Caller', render: (lead) => lead.caller_name || '-' },
    { header: 'Outcome', render: (lead) => <StatusBadge status={pretty(lead.interest_status)} /> },
    { header: 'Completed', render: (lead) => new Date(lead.manager_completed_at).toLocaleString() },
    { header: 'Action', align: 'right', render: (lead) => <button className="p-2 text-blue-600" onClick={() => open(lead)} title="View complete audit history"><Eye size={16}/></button> }
  ];
  return <div><PageHeader title="Manager-Completed Leads" subtitle={`${total} finalized leads across all Managers`} actions={<button onClick={load} className="p-2 text-slate-600"><RefreshCw size={16}/></button>}/>{notice && <div className="mb-4 rounded-xl bg-blue-50 p-3 text-blue-700">{notice}</div>}<div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="h-10 w-full rounded-xl border border-slate-200 pl-9" placeholder="Search ID, clinic or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></div><select className="rounded-xl border border-slate-200 px-3" value={interest} onChange={(e) => { setInterest(e.target.value); setPage(1); }}><option value="">All outcomes</option>{['interested','maybe_interested','not_interested','needs_more_information','follow_up_required','converted','no_response','invalid_lead'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><DataTable columns={columns} data={leads} loading={loading} pagination={{page,limit:15,total}} onPageChange={setPage} emptyState={<EmptyState icon={Trophy} title="No Manager-completed leads" description="Finalized outcomes will appear here with their complete audit history."/>}/></div><Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`${detail?.lead?.lead_id || ''} Complete Audit`} size="lg">{detail?.loading ? <p>Loading...</p> : <div className="space-y-5"><section><h3 className="font-bold">Final Outcome</h3><p>{pretty(detail?.lead?.interest_status)} — {detail?.managerOutcome?.closure_reason || detail?.lead?.closure_reason}</p><p className="text-sm text-slate-600">{detail?.managerOutcome?.communication_summary}</p></section><section><h3 className="font-bold">Caller Outcomes</h3>{detail?.callerOutcomes?.map((item) => <div key={item.id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{item.call_status}</b> | {item.interest_status} | {item.call_date}<p>{item.notes}</p></div>)}</section><section><h3 className="font-bold">Email Timeline</h3>{detail?.emails?.map((item) => <div key={item.id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">{pretty(item.email_stage)}: {item.subject} ({item.status})</div>)}</section><section><h3 className="font-bold">Status History</h3>{detail?.statusHistory?.map((item) => <div key={item.id} className="mt-2 border-l-2 border-blue-500 pl-3 text-sm">{pretty(item.previous_status)} → {pretty(item.new_status)} — {new Date(item.created_at).toLocaleString()}</div>)}</section></div>}</Modal></div>;
}
