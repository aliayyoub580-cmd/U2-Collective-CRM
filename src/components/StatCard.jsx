import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, iconClass = 'icon-blue', trend, trendLabel, onClick, to, prefix = '', suffix = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '18px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        cursor: (to || onClick) ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s'
      }}
      className="hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p style={{ fontSize: '13px', fontWeight: '500', color: '#64748B', marginBottom: '8px' }}>{title}</p>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A', lineHeight: 1.2 }}>
            {prefix}{typeof value === 'number' && value >= 1000 ? value.toLocaleString() : value}{suffix}
          </p>
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>

      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5">
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}%
            </div>
          )}
          {trendLabel && <span style={{ fontSize: '12px', color: '#64748B' }}>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
