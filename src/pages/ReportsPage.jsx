import React, { useState, useEffect } from 'react';
import { BarChart3, Download, RefreshCw, TrendingUp, Users, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import { PrimaryButton, SecondaryButton } from '../components/FormFields';

const COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#0891B2', '#DB2777'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [sourceData, setSourceData] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const [dateRange, setDateRange] = useState({ start: startOfYear, end: today });

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      const params = { start_date: dateRange.start, end_date: dateRange.end };
      if (type === 'sales' || !salesData) {
        const r = await api.get('/reports/sales', { params });
        setSalesData(r.data);
      }
      if (type === 'revenue' || !revenueData) {
        const r = await api.get('/reports/revenue', { params });
        setRevenueData(r.data);
      }
      if (type === 'sources' || !sourceData) {
        const r = await api.get('/reports/lead-sources', { params });
        setSourceData(r.data);
      }
      if (type === 'employees' || !employeeData) {
        const r = await api.get('/reports/employee-tasks', { params });
        setEmployeeData(r.data);
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(activeTab); }, [activeTab, dateRange]);

  const handleExportCSV = async (type) => {
    try {
      const res = await api.get('/reports/export/csv', {
        params: { type, start_date: dateRange.start, end_date: dateRange.end },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${today}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const cardStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '20px' };
  const tabs = [
    { id: 'sales', label: 'Sales Report', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'sources', label: 'Lead Sources', icon: Users },
    { id: 'employees', label: 'Employee Tasks', icon: BarChart3 },
  ];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Business intelligence for U2 Collective LLP"
        actions={
          <>
            <button onClick={() => fetchReport(activeTab)} className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#475569]"><RefreshCw size={16} /></button>
            <button onClick={() => handleExportCSV(activeTab === 'sales' ? 'leads' : activeTab === 'revenue' ? 'revenue' : 'clients')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#475569] text-sm font-semibold transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </>
        }
      />

      {/* Date Range */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Date Range:</span>
        <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          style={{ height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none' }} />
        <span style={{ fontSize: '13px', color: '#64748B' }}>to</span>
        <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          style={{ height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
                border: `1px solid ${activeTab === t.id ? '#2563EB' : '#E2E8F0'}`,
                background: activeTab === t.id ? '#2563EB' : '#FFFFFF',
                color: activeTab === t.id ? '#FFFFFF' : '#475569',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }} /></div>
      ) : (
        <>
          {/* Sales Report */}
          {activeTab === 'sales' && salesData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary cards */}
              <div className="reports-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {[
                  { label: 'Total Leads', value: salesData.total, color: '#2563EB' },
                  { label: 'Contracted', value: salesData.contracted, color: '#16A34A' },
                  { label: 'Not interested', value: salesData.notInterested, color: '#DC2626' },
                  { label: 'Pending', value: salesData.pending, color: '#F59E0B' },
                  { label: 'Conversion Rate', value: `${salesData.conversionRate}%`, color: '#7C3AED' },
                ].map((s, i) => (
                  <div key={i} style={cardStyle}>
                    <p style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</p>
                    <p style={{ fontSize: '26px', fontWeight: '700', color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="reports-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* By Status */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Leads by Status</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesData.byStatus} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Leads" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* By Service */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Leads by Service</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={salesData.byService} dataKey="count" nameKey="service_interested" innerRadius={55} outerRadius={90}>
                        {salesData.byService.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend formatter={(val) => <span style={{ fontSize: '11px' }}>{val}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Leads Table */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Recent Leads</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        {['Client Clinic Name', 'Service', 'Source', 'Status', 'Date'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.recentLeads.slice(0, 10).map(l => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }} className="hover:bg-[#F8FAFC]">
                          <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{l.client_clinic_name || l.company_name}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#475569' }}>{l.service_interested || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#475569' }}>{l.source || '—'}</td>
                          <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: l.status === 'Contracted' ? '#DCFCE7' : l.status === 'Not interested' ? '#FEE2E2' : '#DBEAFE', color: l.status === 'Contracted' ? '#15803D' : l.status === 'Not interested' ? '#B91C1C' : '#1D4ED8' }}>{l.status}</span></td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: '#94A3B8' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Report */}
          {activeTab === 'revenue' && revenueData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={cardStyle}>
                <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Total Revenue</p>
                <p style={{ fontSize: '36px', fontWeight: '800', color: '#16A34A' }}>${Number(revenueData.total).toLocaleString()}</p>
              </div>

              <div className="reports-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Revenue by Month</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueData.byMonth}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                      <Area type="monotone" dataKey="total" stroke="#2563EB" fill="url(#revGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Revenue by Service</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={revenueData.byService} dataKey="total" nameKey="services" innerRadius={55} outerRadius={90}>
                        {revenueData.byService.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                      <Legend formatter={(val) => <span style={{ fontSize: '11px' }}>{val}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top clients */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Top Clients by Revenue</h3>
                {revenueData.byClient.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '700', width: '20px' }}>#{i + 1}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', flex: 1 }}>{c.company_name}</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#16A34A' }}>${Number(c.total).toLocaleString()}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>{c.payment_count} payments</span>
                  </div>
                ))}
                {revenueData.byClient.length === 0 && <p style={{ fontSize: '13px', color: '#94A3B8' }}>No revenue data for selected period</p>}
              </div>
            </div>
          )}

          {/* Lead Sources */}
          {activeTab === 'sources' && sourceData && (
            <div className="reports-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={cardStyle}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Leads by Source</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={sourceData.bySource} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="source" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Total Leads" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="contracted" name="Contracted" fill="#16A34A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Leads by Country</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={sourceData.byCountry} barSize={28} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis dataKey="country" type="category" tick={{ fontSize: 10, fill: '#64748B' }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Employee Tasks */}
          {activeTab === 'employees' && employeeData && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', marginBottom: '20px' }}>Employee Task Performance</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Employee', 'Role', 'Total', 'Completed', 'In Progress', 'Pending', 'Overdue'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeData.byEmployee.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }} className="hover:bg-[#F8FAFC]">
                        <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>{e.name}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569' }}>{e.role}</td>
                        <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{e.total_tasks}</td>
                        <td style={{ padding: '12px 14px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: '#16A34A' }}>{e.completed}</span></td>
                        <td style={{ padding: '12px 14px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB' }}>{e.in_progress}</span></td>
                        <td style={{ padding: '12px 14px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B' }}>{e.pending}</span></td>
                        <td style={{ padding: '12px 14px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: e.overdue > 0 ? '#DC2626' : '#94A3B8' }}>{e.overdue}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
