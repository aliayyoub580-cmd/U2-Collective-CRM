import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const widths = { sm: '480px', md: '640px', lg: '720px', xl: '900px' };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: widths[size],
          background: '#FFFFFF',
          borderRadius: '22px',
          padding: '24px',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
