import React from 'react';

const statusStyles = {
  // Lead statuses
  'Not contract': { bg: '#F1F5F9', color: '#475569' },
  'Contracted': { bg: '#DCFCE7', color: '#15803D' },
  'Follow up': { bg: '#DBEAFE', color: '#1D4ED8' },
  'Meeting scheduled': { bg: '#FEF3C7', color: '#B45309' },
  'Not interested': { bg: '#FEE2E2', color: '#B91C1C' },
  // Task statuses
  'Pending': { bg: '#FEF3C7', color: '#B45309' },
  'In Progress': { bg: '#DBEAFE', color: '#1D4ED8' },
  'Completed': { bg: '#DCFCE7', color: '#15803D' },
  'Cancelled': { bg: '#F1F5F9', color: '#475569' },
  // Proposal statuses
  'Draft': { bg: '#F1F5F9', color: '#475569' },
  'Sent': { bg: '#DBEAFE', color: '#1D4ED8' },
  'Under Review': { bg: '#FEF3C7', color: '#B45309' },
  'Accepted': { bg: '#DCFCE7', color: '#15803D' },
  'Rejected': { bg: '#FEE2E2', color: '#B91C1C' },
  // Client / Employee
  'Active': { bg: '#DCFCE7', color: '#15803D' },
  'Inactive': { bg: '#F1F5F9', color: '#475569' },
  // Priorities
  'Low': { bg: '#F1F5F9', color: '#475569' },
  'Medium': { bg: '#DBEAFE', color: '#1D4ED8' },
  'High': { bg: '#FEF3C7', color: '#B45309' },
  'Urgent': { bg: '#FEE2E2', color: '#B91C1C' },
  // Payment
  'Paid': { bg: '#DCFCE7', color: '#15803D' },
  'Overdue': { bg: '#FEE2E2', color: '#B91C1C' },
  'Pending Payment': { bg: '#FEF3C7', color: '#B45309' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const style = statusStyles[status] || { bg: '#F1F5F9', color: '#475569' };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '4px 10px' : '6px 14px',
      borderRadius: '999px',
      fontSize: size === 'sm' ? '11px' : '13px',
      fontWeight: '600',
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
      lineHeight: 1.4
    }}>
      {status}
    </span>
  );
}
