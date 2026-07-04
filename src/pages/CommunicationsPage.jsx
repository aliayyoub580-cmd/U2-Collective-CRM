import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

const COMM_TYPES = ['LinkedIn Message', 'Email', 'Phone Call', 'WhatsApp', 'Zoom Meeting', 'Google Meet', 'Proposal Sent', 'Client Feedback', 'Internal Note'];
const SOURCES = ['LinkedIn', 'Meta Ads', 'Referral', 'Website', 'Upwork', 'Fiverr', 'Cold Email', 'Other'];
const STATUSES = ['Not contract', 'Contracted', 'Follow up', 'Meeting scheduled', 'Not interested'];

const typeColors = {
  'LinkedIn Message': '#0A66C2', 'Email': '#2563EB', 'Phone Call': '#16A34A',
  'WhatsApp': '#25D366', 'Zoom Meeting': '#2D8CFF', 'Google Meet': '#DB4437',
  'Proposal Sent': '#7C3AED', 'Client Feedback': '#F59E0B', 'Internal Note': '#64748B'
};

export default function CommunicationsPage() {
  const [comms, setComms] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterType, setFilterType] = useState('');

  const fetchComms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/communications', {
        params: {
          page,
          limit: 20,
          status: filterStatus,
          source: filterSource,
          assigned_to: filterAssignedTo,
          type: filterType
        }
      });
      setComms(res.data.communications || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterSource, filterAssignedTo, filterType]);

  useEffect(() => { fetchComms(); }, [fetchComms]);

  useEffect(() => {
    api.get('/employees/users/all')
      .then((res) => setUsers(res.data.users || []))
      .catch(() => {});
  }, []);

  const getTypeColor = (type) => typeColors[type] || '#64748B';

  return (
    <div>
      <PageHeader
        title="Communication Log"
        subtitle={`${total} total communications`}
        actions={
          <button onClick={fetchComms} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
        }
      />

      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: '18px', padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
      }}>
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
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          style={{ height: '40px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '13px', background: '#F8FAFC', outline: 'none', minWidth: '170px' }}
        >
          <option value="">All Communication Types</option>
          {COMM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }} /></div>
      ) : comms.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px' }}>
          <EmptyState icon={MessageSquare} title="No communications logged"
            description="Choose a communication type while adding or editing a lead to show it here." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {comms.map((c) => (
            <div key={c.id} style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: '14px', padding: '16px 20px',
              borderLeft: `4px solid ${getTypeColor(c.type)}`,
              display: 'flex', gap: '16px', alignItems: 'flex-start'
            }}>
              <div style={{
                width: '40px', height: '40px', flexShrink: 0,
                background: getTypeColor(c.type) + '18',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={16} style={{ color: getTypeColor(c.type) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: '600',
                    background: getTypeColor(c.type) + '18', color: getTypeColor(c.type),
                    padding: '3px 10px', borderRadius: '999px'
                  }}>{c.type}</span>
                  {c.status && <StatusBadge status={c.status} />}
                  <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: 'auto' }}>{c.communication_date || c.created_at?.slice(0, 10)}</span>
                </div>
                <p style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700 }}>{c.lead_name || c.client_clinic_name || c.client_name}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px 16px', marginTop: '8px' }}>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Lead ID: <span style={{ color: '#334155' }}>{c.lead_public_id || (c.lead_id ? `#${c.lead_id}` : '-')}</span></p>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Contact: <span style={{ color: '#334155' }}>{c.clinic_email || c.clinic_phone || '-'}</span></p>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Service: <span style={{ color: '#334155' }}>{c.service_interested || '-'}</span></p>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Source: <span style={{ color: '#334155' }}>{c.source || '-'}</span></p>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Assigned To: <span style={{ color: '#334155' }}>{c.assigned_to_name || '-'}</span></p>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>Created: <span style={{ color: '#334155' }}>{c.lead_created_at?.slice(0, 10) || c.created_at?.slice(0, 10) || '-'}</span></p>
                </div>
              </div>
            </div>
          ))}

          {total > 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', background: page === 1 ? '#F8FAFC' : '#FFFFFF', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>
                Previous
              </button>
              <span style={{ padding: '8px 16px', fontSize: '13px', color: '#475569' }}>Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', background: page * 20 >= total ? '#F8FAFC' : '#FFFFFF', cursor: page * 20 >= total ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
