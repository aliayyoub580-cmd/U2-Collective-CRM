import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick, loading, emptyState, pagination, onPageChange }) {
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{ borderWidth: '3px', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }}></div>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Loading data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return emptyState || (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#64748B' }}>No data found</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {columns.map((col, i) => (
                <th key={i} style={{
                  padding: '0 16px',
                  height: '48px',
                  textAlign: col.align || 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  width: col.width
                }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: '1px solid #E2E8F0',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s'
                }}
                className="hover:bg-[#F8FAFC]"
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} style={{
                    padding: '0 16px',
                    height: '58px',
                    fontSize: '14px',
                    color: '#0F172A',
                    textAlign: col.align || 'left',
                    whiteSpace: col.wrap ? 'normal' : 'nowrap'
                  }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > pagination.limit && (
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          borderTop: '1px solid #E2E8F0',
          gap: '12px'
        }}>
          <span style={{ fontSize: '13px', color: '#64748B', flex: 1 }}>
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid #E2E8F0', background: pagination.page <= 1 ? '#F8FAFC' : '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                color: '#475569'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', minWidth: '60px', textAlign: 'center' }}>
              Page {pagination.page}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= pagination.total}
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: '1px solid #E2E8F0', background: pagination.page * pagination.limit >= pagination.total ? '#F8FAFC' : '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: pagination.page * pagination.limit >= pagination.total ? 'not-allowed' : 'pointer',
                color: '#475569'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
