import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, Bell, FileText, DollarSign, CheckSquare, TrendingUp, Activity, UserCheck } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import DailyQuranAyatCard from '../components/DailyQuranAyatCard';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#2563EB', '#7C3AED', '#16A34A', '#F59E0B', '#DC2626', '#0891B2', '#DB2777'];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (user?.role === 'Manager') {
        const response = await api.get('/manager/dashboard');
        setStats(response.data.data || {});
        return;
      }
      const [statsRes, activitiesRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/recent-activities')
      ]);
      setStats(statsRes.data);
      setActivities(activitiesRes.data.activities || []);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div style={{ textAlign: 'center' }}>
          <div className="w-10 h-10 rounded-full animate-spin mx-auto mb-3"
            style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: '#E2E8F0', borderTopColor: '#2563EB' }} />
          <p style={{ fontSize: '14px', color: '#64748B' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (user?.employee_type === 'lead_generator') {
    return (
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Lead Generation Dashboard</h2>
        <p style={{ color: '#64748B', marginBottom: '24px' }}>Track your healthcare lead generation performance.</p>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <StatCard title="Today's Leads" value={stats?.todaysLeads || 0} icon={Users} iconClass="icon-blue" trendLabel="Leads created today" to="/leads" />
          <StatCard title="Total Lead Generated" value={stats?.totalLeadGenerated || 0} icon={TrendingUp} iconClass="icon-green" trendLabel="Lifetime leads generated" to="/leads" />
        </div>
      </div>
    );
  }

  if (user?.employee_type === 'caller') {
    return (
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Caller Dashboard</h2>
        <p style={{ color: '#64748B', marginBottom: '24px' }}>Your assigned clinic outreach and reminders.</p>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <StatCard title="Assigned Leads" value={stats?.assignedLeads || 0} icon={Users} iconClass="icon-blue" trendLabel="Your active assignments" to="/tasks" />
          <StatCard title="Pending Leads" value={stats?.pendingLeads || 0} icon={CheckSquare} iconClass="icon-orange" trendLabel="Awaiting contact" to="/tasks" />
          <StatCard title="Total Follow Ups" value={stats?.totalFollowUps || 0} icon={Bell} iconClass="icon-cyan" trendLabel="All assigned follow-ups" to="/follow-ups" />
          <StatCard title="Pending Follow Ups" value={stats?.pendingFollowUps || 0} icon={Bell} iconClass="icon-red" trendLabel="Awaiting follow-up" to="/follow-ups" />
        </div>
      </div>
    );
  }

  if (user?.role === 'Manager') {
    return (
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Manager Dashboard</h2>
        <p style={{ color: '#64748B', marginBottom: '24px' }}>Your private lead queue and distribution progress.</p>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px' }}>
          <StatCard title="Total Leads" value={stats?.totalLeads || 0} icon={Users} iconClass="icon-blue" trendLabel="Assigned to you" to="/leads" />
          <StatCard title="Assigned" value={stats?.assigned || 0} icon={UserCheck} iconClass="icon-cyan" trendLabel="With your team" to="/leads" />
          <StatCard title="Pending" value={stats?.pending || 0} icon={CheckSquare} iconClass="icon-orange" trendLabel="Awaiting completion" to="/leads" />
          <StatCard title="Leads Completed by Caller" value={stats?.completedByCaller || 0} icon={Bell} iconClass="icon-purple" trendLabel="Ready for manager review" to="/leads" />
          <StatCard title="Leads Completed by Manager" value={stats?.completedByManager || 0} icon={TrendingUp} iconClass="icon-green" trendLabel="Finalized by you" to="/leads" />
        </div>
      </div>
    );
  }

  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
  };

  return (
    <div>
      {/* Welcome Banner */}
      <div className="dashboard-welcome" style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)',
        borderRadius: '18px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.14)'
      }}>
        <div>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
            U2 Collective Command Center
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#64748B', fontSize: '12px', marginBottom: '2px' }}>New leads this month</p>
          <p style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: '700' }}>{stats?.newLeadsThisMonth || 0}</p>
        </div>
      </div>

      <DailyQuranAyatCard />

      {/* Stat Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <StatCard title="Total Leads" value={stats?.totalLeads || 0} icon={Users} iconClass="icon-blue" trendLabel="All time" to="/leads" />
        <StatCard title="Active Clients" value={stats?.totalClients || 0} icon={Briefcase} iconClass="icon-green" trendLabel="Currently active" to="/clients" />
        <StatCard title="Follow-ups Today" value={stats?.followupsToday || 0} icon={Bell} iconClass="icon-orange" trendLabel="Pending today" to="/follow-ups" />
        <StatCard title="Monthly Revenue" value={stats?.monthlyRevenue || 0} icon={DollarSign} iconClass="icon-purple" prefix="$" trendLabel="This month" to="/reports" />
        <StatCard title="Tasks Due Today" value={stats?.tasksDueToday || 0} icon={CheckSquare} iconClass="icon-red" trendLabel="Need attention" to="/tasks" />
        <StatCard title="Pending Proposals" value={stats?.pendingProposals || 0} icon={FileText} iconClass="icon-cyan" trendLabel="Awaiting response" to="/proposals" />
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Lead Status Chart */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '20px' }}>Lead Status Breakdown</h3>
          {stats?.leadsByStatus?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats.leadsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="status"
                >
                  {stats.leadsByStatus.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [val, 'Leads']} />
                <Legend formatter={(val) => <span style={{ fontSize: '12px', color: '#64748B' }}>{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>No lead data yet</p>
            </div>
          )}
        </div>

        {/* Lead Source Chart */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '20px' }}>Leads by Source</h3>
          {stats?.leadsBySource?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.leadsBySource} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>No source data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
            <Activity size={16} className="inline mr-2 text-[#2563EB]" />
            Recent Activities
          </h3>
        </div>
        {activities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {activities.slice(0, 10).map((activity, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: i % 2 === 0 ? '#F8FAFC' : '#FFFFFF'
              }}>
                <div style={{
                  width: '32px', height: '32px',
                  background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Activity size={14} style={{ color: '#2563EB' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#0F172A', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activity.action}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94A3B8' }}>
                    {activity.user_name} | {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: '600',
                  background: '#EDE9FE', color: '#6D28D9',
                  padding: '2px 8px', borderRadius: '999px'
                }}>
                  {activity.module}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#94A3B8', fontSize: '14px' }}>No recent activities</p>
          </div>
        )}
      </div>
    </div>
  );
}
