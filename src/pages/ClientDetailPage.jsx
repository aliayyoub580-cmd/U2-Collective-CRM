import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, MessageSquare, FileText, Plus } from 'lucide-react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { FormInput, FormSelect, FormTextarea, PrimaryButton, SecondaryButton } from '../components/FormFields';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Bank Transfer', status: 'Paid', notes: '' });
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => { fetchClient(); }, [id]);

  const fetchClient = async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setData(res.data);
    } catch (err) { navigate('/clients'); }
    finally { setLoading(false); }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setSavingPayment(true);
    try {
      await api.post(`/clients/${id}/payments`, paymentForm);
      setShowPaymentModal(false);
      fetchClient();
    } catch (err) {} finally { setSavingPayment(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }} /></div>;
  if (!data) return null;

  const { client, payments, communications, proposals, totalRevenue } = data;
  const cardStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '20px' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/clients')} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>{client.company_name}</h1>
            <StatusBadge status={client.status} size="md" />
          </div>
          <p style={{ fontSize: '13px', color: '#64748B' }}>{client.services} · Client since {client.contract_start || 'N/A'}</p>
        </div>
        <PrimaryButton onClick={() => setShowPaymentModal(true)} icon={Plus}>Add Payment</PrimaryButton>
      </div>

      {/* Summary cards */}
      <div className="detail-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Revenue', value: `$${Number(totalRevenue || 0).toLocaleString()}`, color: '#16A34A' },
          { label: 'Monthly Charges', value: `$${Number(client.monthly_charges || 0).toLocaleString()}`, color: '#2563EB' },
          { label: 'Payments Made', value: payments.length, color: '#7C3AED' },
        ].map((s, i) => (
          <div key={i} style={cardStyle}>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>{s.label}</p>
            <p style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="detail-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Client Info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Client Details</h3>
            {[
              ['Contact', client.contact_person],
              ['Email', client.email],
              ['Phone', client.phone],
              ['Country', client.country],
              ['Services', client.services],
              ['Contract Start', client.contract_start],
              ['Contract End', client.contract_end],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', width: '100px', flexShrink: 0, textTransform: 'uppercase' }}>{l}</span>
                <span style={{ fontSize: '14px', color: '#0F172A' }}>{v}</span>
              </div>
            ))}
            {client.notes && (
              <div style={{ marginTop: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '10px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '4px', textTransform: 'uppercase' }}>Notes</p>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>{client.notes}</p>
              </div>
            )}
          </div>

          {/* Proposals */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              <FileText size={14} className="inline mr-2 text-[#7C3AED]" />
              Proposals ({proposals.length})
            </h3>
            {proposals.length > 0 ? proposals.map(p => (
              <div key={p.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '8px', borderLeft: '3px solid #7C3AED' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>${Number(p.amount).toLocaleString()}</p>
              </div>
            )) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No proposals</p>}
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Payment History */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              <DollarSign size={14} className="inline mr-2 text-[#16A34A]" />
              Payment History ({payments.length})
            </h3>
            {payments.length > 0 ? (
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '700', color: '#16A34A' }}>${Number(p.amount).toLocaleString()}</p>
                      <p style={{ fontSize: '11px', color: '#64748B' }}>{p.payment_date} · {p.payment_method}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No payments recorded</p>}
          </div>

          {/* Communications */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              <MessageSquare size={14} className="inline mr-2 text-[#2563EB]" />
              Communications ({communications.length})
            </h3>
            {communications.length > 0 ? (
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {communications.map(c => (
                  <div key={c.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', borderLeft: '3px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px' }}>{c.type}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{c.communication_date}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{c.message}</p>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No communications</p>}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="sm">
        <form onSubmit={handleAddPayment}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormInput label="Amount ($)" type="number" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            <FormInput label="Payment Date" type="date" required value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
            <FormSelect label="Payment Method" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
              {['Bank Transfer', 'Credit Card', 'PayPal', 'Check', 'Cash', 'Wire Transfer'].map(m => <option key={m}>{m}</option>)}
            </FormSelect>
            <FormSelect label="Status" value={paymentForm.status} onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}>
              <option>Paid</option>
              <option>Pending Payment</option>
              <option>Overdue</option>
            </FormSelect>
            <FormTextarea label="Notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <SecondaryButton onClick={() => setShowPaymentModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={savingPayment}>Record Payment</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
