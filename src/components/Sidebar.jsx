import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Bell, MessageSquare,
  CheckSquare, FileText, Briefcase, UserCog, BarChart3,
  Settings, ChevronLeft, ChevronRight
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { path: '/leads', icon: Users, label: 'Leads', module: 'leads' },
  { path: '/follow-ups', icon: Bell, label: 'Follow-Ups', module: 'followups' },
  { path: '/communications', icon: MessageSquare, label: 'Communications', module: 'communications' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks', module: 'tasks' },
  { path: '/proposals', icon: FileText, label: 'Proposals', module: 'proposals' },
  { path: '/clients', icon: Briefcase, label: 'Clients', module: 'clients' },
  { path: '/employees', icon: UserCog, label: 'Employees', module: 'employees' },
  { path: '/reports', icon: BarChart3, label: 'Reports', module: 'reports' },
  { path: '/settings', icon: Settings, label: 'Settings', module: 'dashboard' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { canAccess, user } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter(item => canAccess(item.module));

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '260px',
        background: '#0F172A',
        transition: 'width 0.25s ease',
        flexShrink: 0
      }}
      className="flex flex-col h-screen overflow-hidden relative"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ minHeight: '72px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div
          className={`${collapsed ? 'h-10 w-10' : 'h-12 w-12'} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <img
            src={`${import.meta.env.BASE_URL}U2%20Collective%20Logo.png`}
            alt="U2 Collective"
            className="h-full w-full object-cover"
          />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight">U2 Collective</p>
            <p className="text-[#64748B] text-xs">CRM System</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-[#475569] hover:text-white transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/10"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive: navActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  marginBottom: '2px',
                  textDecoration: 'none',
                  background: isActive ? '#2563EB' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#CBD5E1',
                  transition: 'all 0.15s',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                })}
                className="hover:bg-white/[0.08] group"
                title={collapsed ? item.label : ''}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <span style={{ fontSize: '14px', fontWeight: isActive ? '600' : '500' }}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User info at bottom */}
      {!collapsed && (
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-[#64748B] text-xs truncate">{user?.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
