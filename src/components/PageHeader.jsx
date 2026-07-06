import React from 'react';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header flex items-center justify-between mb-6">
      <div className="min-w-0">
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '13px', color: '#64748B' }}>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions flex items-center gap-3">{actions}</div>}
    </div>
  );
}
