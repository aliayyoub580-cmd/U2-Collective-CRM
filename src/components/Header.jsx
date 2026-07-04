import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, ChevronDown, LogOut, Settings, Menu } from 'lucide-react';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
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
      <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', flexShrink: 0 }}>
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
      <span style={{ fontSize: '13px', color: '#64748B', flexShrink: 0 }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
      </span>

      {/* Notification bell */}
      <button className="relative p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors text-[#64748B] hover:text-[#0F172A]">
        <Bell size={20} />
      </button>

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
