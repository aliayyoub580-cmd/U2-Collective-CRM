import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let timer;
    const showSuccess = (event) => {
      setSuccessMessage(event.detail?.message || 'Action completed successfully.');
      clearTimeout(timer);
      timer = setTimeout(() => setSuccessMessage(''), 4000);
    };
    window.addEventListener('u2crm:mutation-success', showSuccess);
    return () => { window.removeEventListener('u2crm:mutation-success', showSuccess); clearTimeout(timer); };
  }, []);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSidebarOpen((open) => !open);
      return;
    }

    setSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-[#F8FAFC]" style={{ backgroundImage: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2F7 100%)' }}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggle={handleToggleSidebar}
        onNavigate={() => setMobileSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onToggleSidebar={handleToggleSidebar} />
        <main className="app-main flex-1 overflow-y-auto p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      {successMessage && (
        <div role="status" aria-live="polite" className="fixed right-5 top-5 z-[100] flex max-w-md items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-800 shadow-xl">
          <CheckCircle2 size={20} className="shrink-0 text-green-600" />
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} className="ml-2 rounded p-1 text-green-700 hover:bg-green-50" aria-label="Close success message"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
