import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      textAlign: 'center'
    }}>
      {Icon && (
        <div style={{
          width: '72px', height: '72px',
          background: '#F1F5F9',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <Icon size={32} className="text-[#94A3B8]" />
        </div>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '360px', lineHeight: 1.6, marginBottom: action ? '20px' : 0 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
