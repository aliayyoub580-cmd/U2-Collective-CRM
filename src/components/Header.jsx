import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, ChevronDown, LogOut, Settings, Menu } from 'lucide-react';
import api from '../api/axios';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/leads': 'Lead Management',
  '/follow-ups': 'Follow-Up Tracker',
  '/communications': 'Communication Log',
  '/tasks': 'Task Management',
  '/proposals': 'Proposals',
  '/clients': 'Client Management',
  '/employees': 'Employee Management',
  '/reports': 'Reports & Analytics',
  '/settings': 'Settings',
};

export default function Header({ onToggleSidebar }) {
  const { user, logout, employeeTypeLabel } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);

  const pageTitle = Object.entries(pageTitles).find(([path]) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path))
  )?.[1] || 'U2 Collective CRM';

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const load = () => api.get('/notifications').then((res) => setNotifications(res.data.notifications || [])).catch(() => {});
    load(); const timer = setInterval(load, 60000); return () => clearInterval(timer);
  }, []);

  const openNotification = async (item) => {
    if (!item.is_read) { await api.patch(`/notifications/${item.id}/read`); setNotifications((current) => current.map((n) => n.id === item.id ? { ...n, is_read: true } : n)); }
    if (item.lead_id) navigate(`/leads/${item.lead_id}`);
    setShowNotifications(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header" style={{
      height: '72px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexShrink: 0,
      zIndex: 10
    }}>
      <button
        onClick={onToggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <h1 className="app-header-title" style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', flexShrink: 0 }}>
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <div className="hidden md:flex items-center gap-2"
        style={{
          width: '320px',
          height: '42px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          background: '#F8FAFC',
          padding: '0 14px',
          color: '#64748B'
        }}>
        <Search size={17} />
        <input
          aria-label="Search CRM"
          placeholder="Search CRM"
          style={{
            width: '100%',
            border: 0,
            background: 'transparent',
            boxShadow: 'none',
            fontSize: '13px',
            color: '#0F172A'
          }}
        />
      </div>

      {/* Today's date */}
      <span className="app-header-date" style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
      </span>

      {/* Notification bell */}
      <div className="relative"><button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors text-[#64748B] hover:text-[#0F172A]">
        <Bell size={20} />
        {notifications.some((n) => !n.is_read) && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 99, background: '#DC2626', border: '2px solid #FFF' }} />}
      </button>{showNotifications && <div style={{ position: 'absolute', right: 0, top: 46, width: 340, maxHeight: 380, overflowY: 'auto', background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 18px 48px rgba(15,23,42,.16)', zIndex: 60 }}><div style={{ padding: 14, fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Notifications</div>{notifications.length ? notifications.map((item) => <button key={item.id} onClick={() => openNotification(item)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 14, border: 0, borderBottom: '1px solid #F1F5F9', background: item.is_read ? '#FFF' : '#EFF6FF' }}><strong style={{ fontSize: 13 }}>{item.title}</strong><p style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{item.message}</p></button>) : <p style={{ padding: 20, color: '#64748B', fontSize: 13 }}>No notifications</p>}</div>}</div>

      {/* User dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.3 }}>{user?.name}</p>
            <p style={{ fontSize: '11px', color: '#64748B' }}>{user?.role}</p>
            {employeeTypeLabel && <p style={{ fontSize: '10px', color: '#2563EB', fontWeight: 700 }}>{employeeTypeLabel}</p>}
          </div>
          <ChevronDown size={14} className="text-[#64748B]" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 animate-fade-in"
            style={{
              width: '200px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              boxShadow: '0 16px 48px rgba(15,23,42,0.12)',
              overflow: 'hidden',
              zIndex: 50
            }}>
            <div className="p-3 border-b border-[#E2E8F0]">
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{user?.name}</p>
              <p style={{ fontSize: '11px', color: '#64748B' }}>{user?.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#F8FAFC] text-[#0F172A] transition-colors"
                style={{ fontSize: '13px' }}
              >
                <Settings size={15} className="text-[#64748B]" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-[#DC2626] transition-colors"
                style={{ fontSize: '13px' }}
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
