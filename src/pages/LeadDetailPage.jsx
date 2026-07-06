import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, UserCheck, Phone, Mail, Linkedin, Globe, MessageSquare, Bell, FileText } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/FormFields';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const res = await api.get(`/leads/${id}`);
      setData(res.data);
    } catch (err) {
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      await api.post(`/leads/${id}/convert-to-client`);
      navigate('/clients');
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }} />
      </div>
    );
  }

  if (!data) return null;
  const { lead, followups, communications, proposals } = data;
  const clinicName = lead.client_clinic_name || lead.company_name;

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '20px', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' };
  const infoRow = (label, value) => value ? (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', width: '120px', flexShrink: 0, textTransform: 'uppercase', paddingTop: '2px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#0F172A', flex: 1 }}>{value}</span>
    </div>
  ) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/leads')} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>{clinicName}</h1>
            <StatusBadge status={lead.status} size="md" />
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Lead ID {lead.lead_id || `#${lead.id}`} · Added {new Date(lead.created_at).toLocaleDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {lead.status === 'Contracted' && hasRole('CEO', 'Manager') && (
            <PrimaryButton onClick={() => setShowConvertConfirm(true)} loading={converting} icon={UserCheck}>
              Convert to Client
            </PrimaryButton>
          )}
          {hasRole('CEO', 'Manager', 'Sales Representative') && (
            <SecondaryButton onClick={() => navigate('/leads')} icon={Edit}>Edit</SecondaryButton>
          )}
        </div>
      </div>

      <div className="detail-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Contact Info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Contact Information</h3>
            {infoRow('Lead ID', lead.lead_id || `#${lead.id}`)}
            {infoRow('Client Clinic Name', clinicName)}
            {infoRow('Clinic Website', lead.clinic_website)}
            {infoRow('Clinic LinkedIn', lead.clinic_linkedin)}
            {infoRow('Clinic Phone', lead.clinic_phone)}
            {infoRow('Clinic Email', lead.clinic_email)}
            {infoRow('Country', lead.country)}
            {infoRow('State', lead.state)}
            {infoRow('City', lead.city)}
          </div>

          {/* Business Info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Business Details</h3>
            {infoRow('Source', lead.source)}
            {infoRow('Service', lead.service_interested)}
            {infoRow('Practice Size', lead.practice_size)}
            {infoRow('Assigned To', lead.assigned_to_name)}
            {lead.notes && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</p>
                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, background: '#F8FAFC', padding: '12px', borderRadius: '10px' }}>{lead.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Follow-ups */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <Bell size={14} className="inline mr-2 text-[#F59E0B]" />
                Follow-ups ({followups.length})
              </h3>
            </div>
            {followups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {followups.map(f => (
                  <div key={f.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', borderLeft: '3px solid #F59E0B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{f.title}</p>
                      <StatusBadge status={f.status} />
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {f.followup_date} {f.followup_time && `at ${f.followup_time}`} · {f.method}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No follow-ups scheduled</p>}
          </div>

          {/* Communications */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              <MessageSquare size={14} className="inline mr-2 text-[#2563EB]" />
              Communications ({communications.length})
            </h3>
            {communications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {communications.map(c => (
                  <div key={c.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', borderLeft: '3px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px' }}>{c.type}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{c.communication_date}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{c.message}</p>
                    <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>by {c.created_by_name}</p>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No communications logged</p>}
          </div>

          {/* Proposals */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>
              <FileText size={14} className="inline mr-2 text-[#7C3AED]" />
              Proposals ({proposals.length})
            </h3>
            {proposals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {proposals.map(p => (
                  <div key={p.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', borderLeft: '3px solid #7C3AED' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{p.title}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      ${Number(p.amount).toLocaleString()} · {p.sent_date || 'Draft'}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: '13px', color: '#94A3B8' }}>No proposals created</p>}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={handleConvert}
        title="Convert to Client"
        message={`Convert "${clinicName}" to an active client? This will create a client profile with the lead's information.`}
        confirmLabel="Convert to Client"
        danger={false}
      />
    </div>
  );
}
